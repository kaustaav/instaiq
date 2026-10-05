# Backlog

Open items agreed in planning but not done yet. Tick them off (or delete) as they land.

## Security (do before the backend goes to AWS)
- [x] GitHub repo protections on (2026-10-06): secret scanning, push protection, Dependabot alerts + security updates.
      Dependabot PRs target `main`: during the demo freeze, apply them on `develop` instead.
- [x] No long-lived AWS access keys (instance role + Session Manager). Keep it so: CI must use GitHub OIDC.
- [x] Secrets (DB password) in SSM Parameter Store, read by the EC2 instance role. Nothing secret in the repo or the UI bundle.

## AWS cost guardrails (when backend infra exists)
- [ ] CloudWatch log groups: set retention to 7–14 days (default is "never expire"); production logging at INFO.
- [x] Teardown checklist in `docs/DEPLOYMENT.md` for EC2 / EBS volumes + snapshots / public IPs / CloudFront.
      Remember: a stopped RDS instance restarts by itself after 7 days.
- [x] No NAT Gateway, no load balancer, no RDS, no WAF in develop (see the turned-off list in DEPLOYMENT.md).
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
- [x] Rotated the OAuth client secret that was shown in a screenshot (2026-10-06).
- [ ] Add `main`/custom-domain origins to the Google client when going live.
- [ ] Roles (e.g. view-only) if ever needed.

## Backend on AWS
Develop environment live since 2026-10-06; full record in `docs/DEPLOYMENT.md` ("Backend on AWS"), handover in `docs/HANDOVER.md`.
- [x] EC2 t4g.micro + Docker (app + Postgres 17), separate encrypted data disk, Elastic IP, SG open to CloudFront only.
- [x] Settings in Parameter Store, read by the instance role; nightly pg_dump to S3 (14 days); verified a backup.
- [x] HTTPS via CloudFront (caching off, headers passed through); Amplify `develop` points at it with Google sign-in.
- [x] EC2 section in `docs/DEPLOYMENT.md` (operate, cost, teardown, gotchas, turned-off list).
- [x] CI (GitHub Actions `.github/workflows/ci.yml`): backend tests + frontend lint/build on every push to develop/main and on PRs.
- [ ] No auto-redeploy on push: today `deploy.sh` via Session Manager. Target: GitHub Actions builds image -> ECR ->
      deploy via SSM Run Command (needs `workflow` token scope + GitHub OIDC role).
- [ ] Build images in CI, not on the server (removes swap / ~8 min build / 2 min startup pressure).
- [ ] EC2 Launch Template or infrastructure as code (Terraform/CDK) so the environment can be recreated exactly.
- [x] EC2 termination protection on for `influenceiq-develop` (2026-10-06).
- [ ] Revisit the "turned off to save money" list in DEPLOYMENT.md when there's budget (WAF, RDS, t4g.small, CI, alarms).

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
