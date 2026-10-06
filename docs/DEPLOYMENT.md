# Deployment runbook

Everything that runs outside a laptop, how it was built, and how to operate it. The UI is a static site (Amplify, GitHub
Pages); the backend runs on one EC2 server behind CloudFront (develop environment, section "Backend on AWS" below).
Moving all of this to the company's own account: `docs/HANDOVER.md`.

| Environment | URL | Deploys | Config lives in |
|---|---|---|---|
| **AWS Amplify** `main` = **the app** | https://main.d360lwuskrbgul.amplifyapp.com | Automatically on every push to `main` | `amplify.yml`, `customHttp.yml`, plus one console-only rewrite rule (below). **API mode** (talks to the backend, Google sign-in); **password-protected** for now (Hosting -> Access control) |
| ~~Amplify `develop`~~ | retired 2026-10-06 (one branch only) | | |
| GitHub Pages (public demo) | https://kaustaav.github.io/instaiq/ | Manually (see below) | `frontend` script `build:pages` |

AWS account notes: Free plan (credits, cannot be charged). Region **ap-southeast-2 (Sydney)**. The account is assigned that
region; other regions need "advanced features" (check what that does to the Free plan before enabling). App ID `d360lwuskrbgul`,
app name `influencerIq`.

### Amplify environment variables (console: Hosting -> Environment variables)
| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://d30krgd979e950.cloudfront.net/api` | the develop API (CloudFront) |
| `VITE_GOOGLE_CLIENT_ID` | the OAuth client ID (Google Cloud project "InfluenceIQ") | not secret, but kept out of git |

The console doesn't allow an empty "all branches" value, so `amplify.yml` **unsets both on every branch except `main`**:
any other branch connected later (a preview) builds in demo mode. The build log prints `Branch main, API ...` to confirm.
The client demo is GitHub Pages (demo mode, built from tag `demo-2026-10`).

## How an Amplify deploy works
1. `git push` to `main`.
2. Amplify clones the repo and runs `amplify.yml` in `frontend/`: Node from `.nvmrc` → `npm ci` → lint → `npm run build`.
3. If any step fails, nothing is deployed; the site stays on the previous build.
4. `frontend/dist/` is published to Amplify's CDN (CloudFront) with the headers from `customHttp.yml`.
5. Verify: `scripts/smoke-test.sh https://main.d360lwuskrbgul.amplifyapp.com`

Watch a build: Amplify console → app → branch `main` → the latest build → logs per phase.

**Skip a build:** every push to a connected branch builds the UI (~3-5 min, ~$0.01 per build minute), even when only docs or
the backend changed. Put **`[skip-cd]`** in the commit message of such pushes and Amplify skips the build (the site keeps the
previous build). Use it for docs-only and backend-only commits; never for commits that change `frontend/`, `amplify.yml` or
`customHttp.yml`.

## Console-only setting: SPA rewrite rule
Not stored in the repo, so recreate it by hand if the app is ever rebuilt.
Amplify → Hosting → Rewrites and redirects → Manage redirects → replace the JSON with:
```json
[
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
    "status": "200",
    "target": "/index.html"
  }
]
```
Any path without a file extension (`/manage`, `/influencers/42`) gets `index.html` with status 200 and React Router takes over.
Real files (`/favicon.svg`, `/assets/*.js`) are served as themselves. Rule changes apply in seconds, no rebuild needed.
Without it, deep links return 301 + 404 (the page still renders, but monitors and link previews see "not found").

## Rollback
- **Fast:** Amplify console → branch `main` → pick an earlier successful build → **Redeploy this version**. Seconds, no rebuild.
- **Proper:** `git revert <bad-commit> && git push`. Amplify builds and deploys the reverted code, and history shows what happened.

## GitHub Pages (manual)
```bash
cd frontend && npm run build:pages && touch dist/.nojekyll
cd dist && git init -q -b gh-pages && git add -A && git commit -qm "Publish UI demo"
git push -f https://github.com/kaustaav/instaiq.git gh-pages && rm -rf .git
cd ../.. && scripts/smoke-test.sh https://kaustaav.github.io/instaiq --pages
```
Pages can't set response headers or rewrite URLs, so deep links are served from `404.html` (a copy of the app) with status 404.

## Backend on AWS: environment `prod` (since 2026-10-06)
Environment **`prod`**: it is **the app**. It runs branch **`main`** and holds real data (started empty on 2026-10-06,
`DEMO_DATA=false`). It was called `develop` until 2026-10-06 (renamed when the app went to one branch and real data).
It lives in the owner's test account for now; at handover it moves to the company's own account (`docs/HANDOVER.md`).

```
browser --HTTPS--> CloudFront d30krgd979e950.cloudfront.net --HTTP:80--> EC2 "influenceiq-develop"
                                                                          ├─ container crm-backend (Spring Boot, :80 -> 8080)
                                                                          └─ container crm-db (Postgres 17, private network only)
                                                                               data: separate EBS disk mounted at /data
nightly 02:00 UTC: pg_dump -> S3 influenceiq-prod-backups-<account-id>/db/   (kept 14 days)
settings: SSM Parameter Store /influenceiq/prod/*   ->  /etc/influenceiq/app.env on the server (root only)
```

### What exists (all in ap-southeast-2 unless noted)
| Resource | Name / setting | Why |
|---|---|---|
| EC2 instance | `influenceiq-prod` (Name tag; was influenceiq-develop), **t4g.micro** (Arm, 1 GB), Amazon Linux 2023, subnet in **ap-southeast-2a**, IMDSv2 required, credit spec **Standard**, no key pair | One small server for app + DB. Standard credits = no surprise CPU charges. No SSH: Session Manager only |
| Root disk | 12 GiB gp3, encrypted, deleted with the instance | OS, Docker, images |
| **Data disk** | 10 GiB gp3, encrypted, **not** deleted with the instance | The database. Survives a server rebuild: attach to the new server (same AZ), the bootstrap script mounts it without formatting |
| Elastic IP | attached to the instance | Stable address for CloudFront. **Costs money if left unattached** (teardown!) |
| Security group | `influenceiq-develop-web`: inbound **HTTP 80 only from the prefix list `com.amazonaws.global.cloudfront.origin-facing`**; no SSH | Only CloudFront can reach the server; the DB port is never published |
| IAM role | `crm-ec2-role` = `AmazonSSMManagedInstanceCore` + inline `influenceiq-prod-app` (read `/influenceiq/prod/*` parameters; read/write the backup bucket `db/*`) | Least privilege; no access keys anywhere |
| Parameter Store | `/influenceiq/prod/`: `DB_PASSWORD` (SecureString), `GOOGLE_CLIENT_ID`, `ALLOWED_DOMAINS`, `ALLOWED_EMAILS`, `CORS_ORIGINS`, `DEMO_DATA` (all Standard tier = free) | Config outside git; change a value, then redeploy |
| S3 bucket | `influenceiq-prod-backups-<account-id>`, private, SSE-S3, lifecycle `expire-db-backups` (prefix `db/`, 14 days) | Nightly DB dumps |
| CloudFront | distribution `influenceiq-develop-api` (name kept) -> `https://d30krgd979e950.cloudfront.net`; origin = the EC2 public DNS, **HTTP only, port 80**; viewer: redirect HTTP to HTTPS; methods: all; cache policy **CachingDisabled**; origin request policy **AllViewerExceptHostHeader** (passes Authorization + Origin); no response-headers policy (the app sends CORS) | Free HTTPS address in front of the API. Verified: preflight from the develop site OK, other origins 403, Bearer token reaches the app |
| WAF | **Disabled** (see "Turned off" below) | |

Server scripts live in the repo: `deploy/ec2-user-data.sh` (first boot) -> `deploy/server/bootstrap.sh` (swap, Docker, data
disk, backup timer) -> `deploy/server/deploy.sh` (every deploy) and `deploy/server/backup.sh`.

### Operate it (EC2 -> instance -> Connect -> Session Manager)
| Task | Command |
|---|---|
| Deploy the latest `main` | `sudo bash /opt/instaiq/deploy/server/deploy.sh prod main` (args: environment, branch). ~1-3 min when `pom.xml` is unchanged (Docker reuses the cached dependency layer), ~10 min when dependencies change or on a fresh server. The old app keeps running until the new image is built |
| Health | `curl -s localhost/actuator/health` or from anywhere `curl https://d30krgd979e950.cloudfront.net/actuator/health` |
| App logs | `sudo docker logs --tail 100 -f crm-backend` |
| Change a setting | edit it in Parameter Store, then run the deploy command (it re-reads all settings) |
| Back up now | `sudo systemctl start influenceiq-backup.service`; check `sudo journalctl -u influenceiq-backup.service -n 5` |
| Restore a backup | `aws s3 cp s3://<bucket>/db/<file>.dump /tmp/r.dump` then `sudo docker exec -i crm-db pg_restore -U influenceiq -d influenceiq --clean --if-exists < /tmp/r.dump` |
| Postgres shell | `sudo docker exec -it crm-db psql -U influenceiq` |
| First-boot log | `sudo tail -100 /var/log/cloud-init-output.log` |

Startup takes ~2 minutes on t4g.micro (126 s measured), ~10 s on a laptop: expect a short outage per deploy.

### Monthly cost (on-demand Sydney, approx.)
EC2 t4g.micro ~$7.70 + public IPv4 ~$3.65 + disks 22 GB ~$1.80 + S3 <$0.01 + Parameter Store $0 + CloudFront $0 (always-free
tier: 1 TB / 10M requests) = **~$13/month**. The account has a **$20/month spend limit**.

### Turned off or kept small to save money (revisit when there's budget)
| What | Now | Upgrade when budget allows | Cost |
|---|---|---|---|
| CloudFront WAF (firewall + rate limiting) | **Disabled**. The $0 flat-rate plan couldn't be confirmed (see notes), and on pay-as-you-go WAF is billed | Re-enable on the distribution (Security tab), or subscribe to the flat-rate Free/Pro plan where WAF is included. Rate limit 2000 req/IP/5 min (300 is too low for one office IP) | ~$9-10/mo pay-as-you-go; $0 in the Free flat-rate plan |
| Database | Postgres in Docker on the same EC2 | **RDS** (managed, automatic backups, point-in-time restore) when real data goes in: `pg_dump` -> RDS, change `DB_HOST`/`DB_PASSWORD`, redeploy. Keep Postgres 17 | ~+$20/mo |
| Server size | t4g.micro (1 GB RAM, slow startup) | **t4g.small** (2 GB) if it feels slow or runs out of memory: stop -> change type -> start (data kept; Elastic IP stays) | ~+$7.50/mo (total ~$21: above the $20 limit) |
| Builds | On the server (needs swap, ~8 min) | CI (GitHub Actions) builds the image -> ECR -> server pulls it | ECR pennies |
| Logs / alarms | `docker logs` only | CloudWatch Agent + log retention 14 days + an alarm on health | a few $ |
| Backups | Nightly, 14 days, same region | Also copy to a second region / keep monthly for longer | pennies |
| Redundancy | One server, one AZ | Only if the client needs uptime guarantees (load balancer + 2 servers ~+$25/mo) | |

### Notes and gotchas found while building it
- The AWS account is a **member of an AWS Organization** managed elsewhere: its service control policy blocks editing our own
  console role (`AccountFullAccessRole`) and managing **CloudFront flat-rate plans** (`pricingplanmanager`). So the
  distribution shows Billing "Missing permissions" and is on pay-as-you-go. That's why WAF is off.
- The Amplify console requires a value for "all branches" env variables; the `amplify.yml` guard handles it (above).
- Attaching an Elastic IP changes the server's public IP: never do it while the first-boot build is downloading.
- The data disk is found by "the disk that isn't the root disk"; `bootstrap.sh` formats it **only if it's blank**.

### Teardown (the backend), in this order
1. CloudFront: disable the distribution, wait until deployed, then delete.
2. EC2: terminate `influenceiq-prod` (turn off termination protection first if enabled).
3. **Elastic IP: release it** (billed while unattached).
4. EBS: the data disk survives termination: snapshot it if the data matters, then delete the volume.
5. S3: empty and delete the backup bucket (or keep the last dump somewhere first).
6. Parameter Store: delete `/influenceiq/prod/*`. Security group `influenceiq-develop-web`: delete.
7. Keep the IAM role if another server will follow; otherwise remove the inline policy and the role.

## Teardown
Amplify console → app → App settings → General settings → **Delete app**. Removes hosting, builds and the URL.
Also revoke the Amplify GitHub App if it's no longer needed: GitHub → Settings → Applications → AWS Amplify.

## Cost (UI)
Static hosting of ~0.8 MB: fractions of a cent per month. Builds: ~1–2 minutes each, taken from Free plan credits.
Don't enable the Amplify firewall (AWS WAF): it is billed monthly.
