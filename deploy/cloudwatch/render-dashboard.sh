#!/usr/bin/env bash
# Fills in dashboard.json (a template: the repo is public, so account and resource IDs stay out of it) and prints
# the result for CloudWatch -> Dashboards -> <dashboard> -> Actions -> View/edit source.
#   ACCOUNT_ID=… INSTANCE_ID=i-… DISTRIBUTION_ID=E… [REGION=ap-southeast-2] deploy/cloudwatch/render-dashboard.sh | pbcopy
set -euo pipefail
: "${ACCOUNT_ID:?set ACCOUNT_ID}" "${INSTANCE_ID:?set INSTANCE_ID}" "${DISTRIBUTION_ID:?set DISTRIBUTION_ID}"
REGION="${REGION:-ap-southeast-2}"
sed -e "s/\${ACCOUNT_ID}/$ACCOUNT_ID/g" -e "s/\${INSTANCE_ID}/$INSTANCE_ID/g" \
    -e "s/\${DISTRIBUTION_ID}/$DISTRIBUTION_ID/g" -e "s/\${REGION}/$REGION/g" "$(dirname "$0")/dashboard.json"
