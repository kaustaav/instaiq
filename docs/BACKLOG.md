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

## Auth
The client uses its own email domain. Keep the real domain/name OUT of this public repo: config only (env vars).
- [x] Their email is on Google Workspace. Allowed: the whole Workspace domain + the owner's Gmail (ALLOWED_DOMAINS /
      ALLOWED_EMAILS, local `.env` only).
- [x] Sign in with Google (2026-10-05): UI uses Google Identity Services and sends the ID token as a Bearer token;
      the backend (Spring Security resource server) checks signature, issuer, audience (our client ID), expiry,
      verified email, and the Workspace domain via the `hd` claim. 401 / 403 as problem JSON. Audit fields = email.
      Stateless (no sessions/cookies). Token kept in sessionStorage; quiet renewal before expiry, re-sign-in overlay.
- [ ] Google Cloud project is in "Testing": only listed test users can sign in. Before company use: add their
      people as test users, or publish the app (basic scopes need no Google review).
- [ ] Rotate the OAuth client secret that was shown in a screenshot (unused by us, but exposed).
- [ ] Add `main`/custom-domain origins to the Google client when going live.
- [ ] Roles (e.g. view-only) if ever needed.

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
- [x] `develop` connected to Amplify: https://develop.d360lwuskrbgul.amplifyapp.com (password-protected, demo mode until an API is deployed).
- [x] Write APIs: create/edit influencer (via Ingestion Service), notes, status, rate cards. Optimistic locking (`version`), 409 duplicate/conflict.
- [x] UI writes through the API in API mode: add/edit drawer, notes, status, Manage list (`fresh=` filter) with archive instead of delete.
- [x] Custom niches/languages: `POST /api/reference/categories|languages` (idempotent, case-insensitive); API mode loads
      the lists from `GET /api/reference`.
- [ ] API mode gaps: adding new cities (geo list is fixed); campaigns still use built-in data, so influencers created
      via the API show as "Influencer #id" in campaigns until the campaigns backend exists.
- [ ] Campaigns backend (full, as designed), in steps:
  - [x] 1a. API: campaigns + members (create, edit with version, duplicate, list summaries, add members in bulk, remove)
  - [x] 1b. UI on the campaigns API (API mode): list, create/edit, duplicate, add (one/all), remove, profile history;
        status/stage/terms/drafts/payments/notes view-only in API mode until steps 2-4
  - [x] 2. Campaign status machine + member stages (with reasons) + member notes, API and UI
  - [x] 3. Agree terms, deliverables + draft review loop (API + UI; suggested fee from the rate card)
  - [x] 4. Payments (receipt links), fee change, write-off (API + UI)
  - [ ] 5. CSV export of a campaign
- [ ] No way to rename/remove a custom niche or language yet (needs an admin screen + rules for influencers using it).
- [ ] Discovery source isn't on the add/edit form yet (API defaults to OTHER; edits keep the stored value).
- [ ] Campaign tables + API (port `frontend/src/lib/campaigns.ts` rules to a Java service).
- [ ] Reference data (cities, categories, languages): `GET /api/reference` with ETag, cached in backend memory and in the
      browser; refetch on tab focus and when a filter panel / form opens (option b). `POST /api/taxonomy` normalises and
      dedupes via a unique index on lower(value). Multi-instance later: short TTL or Postgres LISTEN/NOTIFY.
- [ ] UI (doable now): edit form shows the influencer's own category/language values even if missing from the option list.
- [x] Split hosting ready: token auth (no cookies), CORS for the UI origin (CORS_ORIGINS), API URL as build-time
      config (`VITE_API_URL`).

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
