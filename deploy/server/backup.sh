#!/bin/bash
# Nightly backup (systemd timer influenceiq-backup.timer): a compressed dump of the database, uploaded to S3.
# The bucket's lifecycle rule deletes dumps older than 14 days.
#   Run now:   sudo systemctl start influenceiq-backup.service
#   Restore:   aws s3 cp s3://<bucket>/db/<file>.dump /tmp/r.dump
#              docker exec -i crm-db pg_restore -U influenceiq -d influenceiq --clean --if-exists < /tmp/r.dump
set -euo pipefail
source "$(dirname "$0")/common.sh" "${1:-develop}"

FILE="influenceiq-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "/tmp/$FILE"
aws s3 cp --region "$REGION" --only-show-errors "/tmp/$FILE" "s3://$BACKUP_BUCKET/db/$FILE"
rm -f "/tmp/$FILE"
echo "Backed up to s3://$BACKUP_BUCKET/db/$FILE"
