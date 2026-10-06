#!/bin/bash
# Deploy (first time and every update): fetch settings from Parameter Store, get the latest code, build the app
# image, start the database if needed, replace the app container, wait until it's healthy.
#   sudo bash /opt/instaiq/deploy/server/deploy.sh prod main      (args: environment, branch)
set -euo pipefail
source "$(dirname "$0")/common.sh" "${1:-prod}"
BRANCH="${2:-main}"

# 1. Settings: /influenceiq/<env>/NAME -> NAME=value, in root-only files on this server (never in git).
mkdir -p "$CONF_DIR" && chmod 700 "$CONF_DIR"
aws ssm get-parameters-by-path --region "$REGION" --path "/influenceiq/$ENV" --with-decryption \
    --query 'Parameters[].[Name,Value]' --output text \
  | awk -F'\t' '{ n=$1; sub(".*/", "", n); print n "=" $2 }' > "$CONF_DIR/app.env.new"
grep -q '^DB_PASSWORD=' "$CONF_DIR/app.env.new" || { echo "DB_PASSWORD missing in /influenceiq/$ENV" >&2; exit 1; }
cat >> "$CONF_DIR/app.env.new" <<VARS
DB_HOST=$DB_CONTAINER
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
VARS
mv "$CONF_DIR/app.env.new" "$CONF_DIR/app.env" && chmod 600 "$CONF_DIR/app.env"
DB_PASSWORD=$(sed -n 's/^DB_PASSWORD=//p' "$CONF_DIR/app.env")

# 2. Code
git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
git -C "$APP_DIR" reset --hard "origin/$BRANCH"
echo "Deploying $(git -C "$APP_DIR" log -1 --format='%h %s')"

# 3. Image (build before stopping anything: if the build fails, the running app stays up)
docker build -t crm-backend:latest "$APP_DIR/backend"

# 4. Database: Postgres 17 (same major version as a future RDS), data on the data disk, reachable only inside
#    the private Docker network (no port published on the server).
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK"
if ! docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  docker run -d --name "$DB_CONTAINER" --network "$NETWORK" --restart unless-stopped -m 256m \
    -e POSTGRES_DB="$DB_NAME" -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -v "$DATA_DIR/postgres:/var/lib/postgresql/data" \
    postgres:17 -c shared_buffers=64MB -c max_connections=30
fi
for i in $(seq 1 30); do docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -q && break; sleep 2; done

# 5. App: replace the old container; server port 80 -> 8080 in the container (CloudFront talks to port 80).
docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$APP_CONTAINER" --network "$NETWORK" --restart unless-stopped -m 600m \
  --env-file "$CONF_DIR/app.env" -p 80:8080 crm-backend:latest

# 6. Wait for "UP" (Flyway migrations and, on a fresh database, demo data run first)
for i in $(seq 1 60); do
  if curl -fs http://localhost/actuator/health | grep -q '"UP"'; then echo "Healthy"; docker image prune -f >/dev/null; exit 0; fi
  sleep 5
done
echo "App didn't become healthy; last log lines:" >&2
docker logs --tail 50 "$APP_CONTAINER" >&2
exit 1
