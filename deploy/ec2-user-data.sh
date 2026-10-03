#!/bin/bash
# EC2 "user data": runs once, as root, on the instance's first boot (Amazon Linux 2023, arm64).
# Paste into: Launch instance -> Advanced details -> User data.
# Output log on the instance: /var/log/cloud-init-output.log
#
# Walking-skeleton deploy: builds the image on the server from the public repo. Later this becomes
# "CI builds the image -> pushes to ECR -> server pulls it".
set -euxo pipefail

# 1. Swap. t4g.micro has 1 GB RAM; the Maven build inside Docker needs more than that.
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2. Docker + git, and start Docker now and on every boot.
dnf install -y docker git
systemctl enable --now docker

# 3. Get the code (public repo, so no credentials needed).
git clone --depth 1 https://github.com/kaustaav/instaiq.git /opt/instaiq

# 4. Build the image, then run it:
#    -p 80:8080                 web port 80 on the server -> 8080 in the container
#    --restart unless-stopped   start again after a crash or a server reboot
#    -m 700m                    cap the container's memory (leaves room for the OS); Java sizes its heap from this
docker build -t crm-backend /opt/instaiq/backend
docker run -d --name crm-backend --restart unless-stopped -p 80:8080 -m 700m crm-backend
