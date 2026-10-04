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
- [x] Everything in one region: **ap-southeast-2 (Sydney)**, decided 2026-10-02. Region is config, never hard-coded.
- [ ] Billing data lags up to ~24h; check Credits page / Cost Explorer (excluding credits) for real usage.

## Auth (to discuss)
The client uses its own email domain. Keep the real domain/name OUT of this public repo — config only (env vars).
- [ ] Find out: is their email on **Google Workspace or Microsoft 365**? (their IT, or `dig MX <domain> +short`)
- [ ] Who may sign in: everyone on the domain, or a specific group? Roles needed (admin vs member)?
- [ ] Target design: SSO with their identity provider via standard OIDC (Spring Security), restricted to their domain
      (+ the owner's own account). No passwords stored. Token auth while UI and API are on different sites;
      cookies become fine once both live under their domain (crm./api.).
- [ ] Interim options discussed (none chosen): (a) frontend-only Google sign-in — UX gate only, bypassable, allow-list
      stored as hashes, client ID + allow-list in Amplify env vars / `.env.local`, GitHub Pages demo stays open;
      needs CSP update for accounts.google.com. (b) Amplify Access control (password) — real server-side lock.

## Backend on AWS (walking skeleton)
Done 2026-10-03: EC2 t4g.micro (Sydney) built the image from GitHub and served /actuator/health; then torn down
(instance terminated, SG deleted). Kept: IAM role `crm-ec2-role` (SSM only) for reuse.
- [ ] Commit pending: ASCII-only `deploy/ec2-user-data.sh` + this backlog.
- [x] Torn down after the test (instance + security group).
- [ ] No auto-redeploy on push. Today: manual via Session Manager (git pull, docker build, rm, run).
      Target: GitHub Actions builds image -> ECR -> deploy via SSM Run Command (needs `workflow` token scope + GitHub OIDC role).
- [ ] EC2 Launch Template (versioned: AMI, type, SG, role, encryption, credits, user data) instead of re-clicking the wizard.
- [ ] If user data fetches the script from GitHub instead of pasting, pin to a commit SHA (not `main`).
- [ ] HTTPS + stable address: CloudFront in front of EC2 (or a domain + certificate).
- [ ] Build images in CI, not on the server (removes the 1 GB RAM / swap / ~8 min build).
- [ ] Add EC2 section to `docs/DEPLOYMENT.md` (launch, redeploy, logs, teardown).
- [ ] Later: infrastructure as code (Terraform/CDK) for EC2 + RDS + CloudFront.

## Backend (next milestone)
- [x] Run `./mvnw spring-boot:run` in `backend/`, check `/actuator/health` → `{"status":"UP"}`.
- [x] Docker Compose with Postgres only (port 5433; a native Postgres already uses 5432).
- [x] Flyway V1 (reference data) + V2 (influencer, rate card); JPA entities; Ingestion Service; demo loader (DEMO_DATA=true).
- [x] `GET /api/influencers` (search, UI's URL params, parity with UI filters), `GET /api/influencers/{id}`, `GET /api/reference` (ETag).
- [x] UI reads search + profile from the API when `VITE_API_URL` is set (Vite proxy `/api` -> :8080 locally); demo mode otherwise.
- [ ] **Next (agreed): connect `develop` to Amplify** as a second, password-protected UI (own URL; demo mode until an API is deployed).
- [ ] Write APIs: create/edit influencer (via Ingestion Service), notes, status, rate cards.
- [ ] Campaign tables + API (port `frontend/src/lib/campaigns.ts` rules to a Java service).
- [ ] Reference data (cities, categories, languages): `GET /api/reference` with ETag, cached in backend memory and in the
      browser; refetch on tab focus and when a filter panel / form opens (option b). `POST /api/taxonomy` normalises and
      dedupes via a unique index on lower(value). Multi-instance later: short TTL or Postgres LISTEN/NOTIFY.
- [ ] UI (doable now): edit form shows the influencer's own category/language values even if missing from the option list.
- [ ] Design for split hosting (UI on Amplify/Pages, API on EC2 behind CloudFront): token auth (not session cookies),
      CORS for the UI origins, API URL as build-time config (`VITE_API_URL`).

## UI
- [ ] Create / rename / delete lists + "Save results as shortlist". **Decide naming: Campaigns vs Shortlists.**
- [ ] Block duplicate handles; accept pasted instagram.com URLs; validate handle characters.
- [ ] Sort search results (followers, engagement, recently updated, relevance).
- [ ] Missing data-model fields: source, recent captions, metrics updated-by + MANUAL/SYSTEM.
- [ ] Archive instead of hard delete.

## Engineering hygiene
- [ ] Unit tests (Vitest) for `frontend/src/lib/` — filters, pagination, URL params, save rules — and run them in `amplify.yml`.
- [ ] PR workflow: feature branches + Amplify PR previews; keep `main` always deployable.

- [ ] Amplify rebuilds the frontend on every push to `main`, even backend-only commits. Fix: Amplify diff/path-based
      builds, or move the frontend deploy to CI triggered only on `frontend/**`.

## Learning exercises
- [ ] Test the Amplify build-failure email (push a broken commit to a throwaway branch).
- [ ] Teardown drill: delete the Amplify app and rebuild it from `docs/DEPLOYMENT.md` alone.

## Fallback: OCI (only if AWS goes over budget)
- [ ] OCI Always Free: one Arm (A1) VM running Docker Compose (Spring Boot + Postgres), free load balancer for HTTPS,
      nightly `pg_dump` to Object Storage. Home region in India (Mumbai/Hyderabad) — it can't be changed later.
- [ ] Keep Docker images multi-arch (arm64 + amd64) so the same image runs on OCI A1 and AWS Graviton.

## Phase 2 (parked)
Excel import (Spring Batch) and .xlsx export · OpenSearch · Redis · metric refresh via scraper/API (prefer the Instagram Graph
API Business Discovery; keep contact details manual) · campaign management · brand access.
