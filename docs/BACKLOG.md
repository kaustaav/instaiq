# Backlog

Open items agreed in planning but not done yet. Tick them off (or delete) as they land.

## Security (do before the backend goes to AWS)
- [ ] **GitHub repo protections** (repo is public; all three are free and currently OFF):
      secret scanning, **push protection** (blocks a push that contains a key), Dependabot security updates.
      `gh api -X PATCH repos/kaustaav/instaiq -F 'security_and_analysis[secret_scanning][status]=enabled' -F 'security_and_analysis[secret_scanning_push_protection][status]=enabled'`
      plus Dependabot under Settings → Code security. Verify: `gh api repos/kaustaav/instaiq --jq .security_and_analysis`
- [ ] Never create long-lived AWS access keys. CI deploys use GitHub OIDC → an IAM role (temporary credentials).
- [ ] Secrets (DB password, signing keys) in SSM Parameter Store, read by the EC2 instance role. Nothing secret in the repo or the UI bundle.

## AWS cost guardrails (when backend infra exists)
- [ ] CloudWatch log groups: set retention to 7–14 days (default is "never expire"); production logging at INFO.
- [ ] Teardown checklist in `docs/DEPLOYMENT.md` for EC2 / RDS / EBS volumes + snapshots / public IPs / CloudFront.
      Remember: a stopped RDS instance restarts by itself after 7 days.
- [ ] No NAT Gateway, no load balancer, no Multi-AZ RDS, no WAF in Phase 1.
- [ ] Everything in one region (currently ap-southeast-2). Decide on Mumbai only if "advanced features" is safe for the Free plan.
- [ ] Billing data lags up to ~24h; check Credits page / Cost Explorer (excluding credits) for real usage.

## Backend (next milestone)
- [ ] Run `./mvnw spring-boot:run` in `backend/`, check `/actuator/health` → `{"status":"UP"}`.
- [ ] Docker Compose with Postgres only.
- [ ] First table + `GET /api/influencers`; search via `InfluencerSearchService` (Postgres FTS).
- [ ] Design for split hosting (UI on Amplify/Pages, API on EC2 behind CloudFront): token auth (not session cookies),
      CORS for the UI origins, API URL as build-time config (`VITE_API_URL`).
- [ ] Decide auth: Amazon Cognito vs Spring Security + users in Postgres.

## UI
- [ ] Create / rename / delete lists + "Save results as shortlist". **Decide naming: Campaigns vs Shortlists.**
- [ ] Block duplicate handles; accept pasted instagram.com URLs; validate handle characters.
- [ ] Sort search results (followers, engagement, recently updated, relevance).
- [ ] Missing data-model fields: source, recent captions, metrics updated-by + MANUAL/SYSTEM.
- [ ] Login screen placeholder + sign out.
- [ ] Archive instead of hard delete.

## Engineering hygiene
- [ ] Unit tests (Vitest) for `frontend/src/lib/` — filters, pagination, URL params, save rules — and run them in `amplify.yml`.
- [ ] PR workflow: feature branches + Amplify PR previews; keep `main` always deployable.

## Learning exercises
- [ ] Test the Amplify build-failure email (push a broken commit to a throwaway branch).
- [ ] Teardown drill: delete the Amplify app and rebuild it from `docs/DEPLOYMENT.md` alone.

## Phase 2 (parked)
Excel import (Spring Batch) and .xlsx export · OpenSearch · Redis · metric refresh via scraper/API (prefer the Instagram Graph
API Business Discovery; keep contact details manual) · campaign management · brand access.
