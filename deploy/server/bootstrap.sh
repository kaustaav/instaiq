#!/bin/bash
# One-time server setup (run by user data on first boot): swap, Docker, the data disk, the nightly backup timer,
# then the first deploy. Safe to run again.
#   bash bootstrap.sh <env> <branch>
set -euxo pipefail
source "$(dirname "$0")/common.sh" "${1:-prod}"
BRANCH="${2:-main}"

# 1. Swap: t4g.micro has 1 GB RAM; building the app image needs more for a few minutes.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Docker, started now and on every boot.
dnf install -y docker
systemctl enable --now docker

# 3. The data disk: the second disk (the one without the OS). Formatted ONLY if it's blank, so a disk moved from an
#    old server keeps its database. Mounted at /data on every boot ("nofail": the server still boots without it).
ROOT_DISK=$(lsblk -no PKNAME "$(findmnt -no SOURCE /)")
DATA_DISK=$(lsblk -dpno NAME,TYPE | awk '$2=="disk"{print $1}' | grep -v "/dev/${ROOT_DISK}$" | head -n1)
if [ -z "$DATA_DISK" ]; then echo "No data disk attached: add a second EBS volume" >&2; exit 1; fi
if ! blkid "$DATA_DISK" >/dev/null 2>&1; then mkfs -t xfs "$DATA_DISK"; fi
mkdir -p "$DATA_DIR"
UUID=$(blkid -s UUID -o value "$DATA_DISK")
grep -q "$UUID" /etc/fstab || echo "UUID=$UUID $DATA_DIR xfs defaults,nofail 0 2" >> /etc/fstab
mountpoint -q "$DATA_DIR" || mount "$DATA_DIR"
mkdir -p "$DATA_DIR/postgres"

# 4. Nightly database backup to S3 at 02:00 UTC (systemd timer: Amazon Linux 2023 has no cron by default).
cat > /etc/systemd/system/influenceiq-backup.service <<UNIT
[Unit]
Description=InfluenceIQ database backup to S3
[Service]
Type=oneshot
ExecStart=/bin/bash $APP_DIR/deploy/server/backup.sh $ENV
UNIT
cat > /etc/systemd/system/influenceiq-backup.timer <<UNIT
[Unit]
Description=Nightly InfluenceIQ database backup
[Timer]
OnCalendar=*-*-* 02:00:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now influenceiq-backup.timer

# 5. First deploy.
bash "$APP_DIR/deploy/server/deploy.sh" "$ENV" "$BRANCH"
