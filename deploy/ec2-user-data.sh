#!/bin/bash
# EC2 "user data": runs once, as root, on the instance's first boot (Amazon Linux 2023, arm64).
# Paste into: Launch instance -> Advanced details -> User data.   Log: /var/log/cloud-init-output.log
#
# Keep this tiny: it only fetches the repo and hands over to deploy/server/bootstrap.sh, which is version-controlled.
# ENV picks the settings folder in Parameter Store (/influenceiq/<ENV>/...) and the backup bucket; BRANCH is the git
# branch to deploy.
set -euxo pipefail
ENV=prod
BRANCH=main

dnf install -y git
git clone --depth 1 --branch "$BRANCH" https://github.com/kaustaav/instaiq.git /opt/instaiq
bash /opt/instaiq/deploy/server/bootstrap.sh "$ENV" "$BRANCH"
