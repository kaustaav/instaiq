# Handover: taking InfluenceIQ live for the company

What it takes to move from today's setup (owner's AWS test account, demo data, a few test users) to the company running
it. Written so their IT team, or whoever does it, can follow it without the original developer. Keep it up to date as
things change. Company-specific values (domain, emails, account IDs) never go in this public repo: they are settings.

## What they get
- The code (this repository) and its history; docs in `docs/` (`DATA_MODEL.md`, `DEPLOYMENT.md`, `BACKLOG.md`).
- A backend that is plain Spring Boot + PostgreSQL in Docker: no AWS-only code, so it runs on any cloud or server.
- Every setting comes from environment variables (see "Settings" below); nothing is hard-coded per company.

## Recommended production setup (their AWS account)
| Piece | Today (owner's test account, env `prod`) | Production (recommended, their account) | Rough cost / month |
|---|---|---|---|
| AWS account | owner's test account (member of someone else's Organization, $20 limit) | **the company's own account** | — |
| Region | ap-southeast-2 (Sydney) | their choice (e.g. **ap-south-1 Mumbai** for India): it's config only | — |
| Server | EC2 t4g.micro, app + DB in Docker | EC2 **t4g.small** running the app only | ~$15 |
| Database | Postgres 17 in Docker, nightly dump to S3 | **RDS PostgreSQL 17** (db.t4g.micro, 20 GB, automatic backups 7+ days) | ~$20 |
| HTTPS / address | CloudFront `*.cloudfront.net` | CloudFront with their domain, e.g. `crm-api.<company>.com` + free ACM certificate; UI at `crm.<company>.com` | $0–15 (flat-rate plan with WAF) |
| Firewall | off | **on** (WAF via CloudFront flat-rate plan, rate limit ~2000 / 5 min per IP) | included in the plan |
| UI hosting | Amplify (password-protected develop branch) | Amplify (or S3 + CloudFront) with their domain, no Amplify password (Google sign-in protects it) | ~$0–1 |
| Deploys | manual script via Session Manager | GitHub Actions (OIDC, no keys) builds image -> ECR -> deploy | ~$0 |
| Monitoring | none | CloudWatch log retention + health alarm to their email | a few $ |

Total roughly **$35–50/month** for production at their size.

## Checklist
### Accounts and access
- [ ] Company AWS account; give the deployer an IAM Identity Center user (no root, MFA on, no long-lived keys).
- [ ] Budget alerts in their account (e.g. 50 / 80 / 100% of the agreed monthly amount).
- [ ] Code: transfer the repo to their GitHub org, or give them a copy; decide who owns it (see the engagement terms).
- [ ] Turn on GitHub secret scanning + push protection + Dependabot (see BACKLOG "Security").

### Sign-in (Google Workspace)
- [ ] Create the Google Cloud project **inside their Workspace** (then the OAuth consent screen can be **Internal**: only
      their staff can even attempt to sign in). Or move ours into their organization.
- [ ] OAuth client: authorized JavaScript origins = the production UI address(es).
- [ ] Settings: `GOOGLE_CLIENT_ID`, `ALLOWED_DOMAINS=<their workspace domain>`, `ALLOWED_EMAILS` only for exceptions.
- [ ] Decide roles if needed (today everyone allowed can do everything).

### Data
- [ ] Production starts with `DEMO_DATA=false` (never load demo influencers/campaigns into production).
- [ ] Decide what to bring over: start empty, or import their existing list (bulk import is a Phase 2 feature; until then
      the add form, or a one-off script).
- [ ] Personal data (influencer emails/phones): agree who is responsible under India's DPDP Act; keep access to staff,
      backups encrypted (they are), and a way to delete a person's data on request.

### Infrastructure (follow DEPLOYMENT.md "Backend on AWS", with production names)
- [ ] Parameter Store `/influenceiq/prod/*` (DB_HOST/DB_PASSWORD of RDS, GOOGLE_CLIENT_ID, ALLOWED_DOMAINS,
      ALLOWED_EMAILS, CORS_ORIGINS = production UI address, DEMO_DATA=false).
- [ ] RDS PostgreSQL 17, private (not publicly accessible), security group allowing only the app server.
- [ ] EC2 app server with `ENV=prod`, CloudFront in front, WAF on, their domain + certificate.
- [ ] Amplify (or S3 + CloudFront) for the UI with `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`; update `customHttp.yml`
      (CSP connect-src) and the `amplify.yml` branch guard for their production branch.
- [ ] CI deploys (GitHub Actions + OIDC) so nobody deploys from a laptop.
- [ ] Health alarm + log retention; test a backup restore once.

### Hand over
- [ ] Walk their IT team through DEPLOYMENT.md: deploy, logs, settings, backup/restore, teardown.
- [ ] Give them the list of everything that costs money and where to see the bill.
- [ ] Move the data (restore the latest backup into their RDS), then shut down the owner's environment (DEPLOYMENT.md
      "Teardown"), or keep it as their staging.
