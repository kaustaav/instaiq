#!/bin/bash
# Shared by the server scripts. Everything about where we are comes from the instance itself (no hard-coded region
# or account), so the same scripts work in another region or AWS account.
set -euo pipefail

ENV="${1:-develop}"
APP_DIR=/opt/instaiq
CONF_DIR=/etc/influenceiq            # generated settings files, root-only
DATA_DIR=/data                       # the separate data disk
NETWORK=crm                          # private Docker network: the app reaches the DB by name, nothing else can
DB_CONTAINER=crm-db
APP_CONTAINER=crm-backend
DB_NAME=influenceiq
DB_USER=influenceiq

# Instance metadata (IMDSv2: ask for a short-lived token first)
imds() {
  local token
  token=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 300')
  curl -s -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/$1"
}
REGION=$(imds meta-data/placement/region)
ACCOUNT_ID=$(imds dynamic/instance-identity/document | sed -n 's/.*"accountId" *: *"\([0-9]*\)".*/\1/p')
BACKUP_BUCKET="influenceiq-${ENV}-backups-${ACCOUNT_ID}"
