# InfluenceIQ — Influencer CRM

Internal CRM for an influencer marketing agency: store Instagram micro/nano influencers once, search/filter them across campaigns, shortlist and export. Phase 1 only (no scraper, no brand access, no campaign management).

## Repo layout
- `backend/` — Spring Boot 4.1 (Java 21, Maven wrapper `./mvnw`), package `com.influenceiq.crm`
- `frontend/` — React 19 + TypeScript + Vite + React Router; working UI prototype on in-memory seed data (500 synthetic influencers)
- `docs/design/design_handoff_influencer_crm/` — high-fidelity HTML prototype + handoff spec (`README.md`). Open `Influencer CRM v2.dc.html` in a browser.

## Stack (Phase 1)
Spring Boot · PostgreSQL (data **and** search) · React · Docker Compose locally → AWS (EC2, RDS).
- **No OpenSearch and no Redis in Phase 1** (decided 2026-10-01). Search uses Postgres: `tsvector` + GIN for bio/captions/hashtags/name, `pg_trgm` for handle/name fuzzy match, array columns + GIN for categories/languages/hashtags, btree for followers/engagement.
- Search sits behind an `InfluencerSearchService` interface so an OpenSearch implementation can be added in Phase 2 without touching callers.
- Cost constraint: user can't pay. Develop locally; deploy to AWS free tier deliberately and tear down when idle.

## Backlog
Open items (security toggles, cost guardrails, backend next steps, UI gaps) live in `docs/BACKLOG.md`. Check it when planning; tick items off as they land.

## Working style
- Build in very small steps. After each step, stop and give exact local test steps; the user tests before anything else is written.
- User: strong Java, learning Spring Boot/Docker. Teach new tooling concepts briefly; skip basics; push back on wrong approaches.

## Architecture principles
- All influencer writes go through an Ingestion Service with pluggable adapters (form, Excel now; API/scraper later).
- Metric values carry source (MANUAL / SYSTEM), updated-at and updated-by.
- Metric refresh goes through a job interface (manual trigger now, cron later).
- Search is an interface; Postgres implementation now, OpenSearch possible later.

## Scope changes
- Excel (bulk import via Spring Batch, and .xlsx export) moved to **Phase 2**. Phase 1 exports shortlists as CSV.
- OpenSearch and Redis moved to **Phase 2** (or later, only if needed).

## Frontend routing
- React Router, library mode. URLs: `/search?…`, `/influencers/:id`, `/campaigns/:id`, `/manage?q=&tier=&page=`.
- Search query params (`q`, repeated `loc=city:X|state:Y`, `cat`, `lang`, `fmin`, `fmax`, `er`, `page`, `view`) are defined in `frontend/src/lib/search.ts` and are the contract for the search API.
- Deployment: whatever serves the frontend must fall back to `index.html` for unknown paths, or refreshing a deep link 404s.
- Deployments, rollback, teardown and console-only settings: see `docs/DEPLOYMENT.md`. Verify any deploy with `scripts/smoke-test.sh <url>`.
- AWS Amplify: https://main.d360lwuskrbgul.amplifyapp.com (auto-deploys on push to `main`; build spec `amplify.yml`, headers `customHttp.yml`).
- Public demo: https://kaustaav.github.io/instaiq/ (GitHub Pages, served from the `gh-pages` branch; repo is public). No CI. To redeploy:
  `cd frontend && npm run build:pages && touch dist/.nojekyll`, then force-push the contents of `dist/` to the `gh-pages` branch.

## Open questions
- The design calls saved lists **Campaigns**; the brief calls them **shortlists** and puts campaign management in Phase 2. Resolve before building that feature.

## Product decisions from design (don't regress)
- Terminology: the list of influencers for a brand push is a **Campaign** (nav "Campaigns", "Add to Campaign"). The per-card action is **"+ Shortlist"**.
- **One influencer appears only once per campaign.** Counts and CSV exports de-duplicate.
- Add/Edit form required fields: name, Instagram handle, ≥1 city **or** state, ≥1 niche, **followers (>0)**.
- Form placeholders are generic ("Full name", "handle", "0", "₹"…), never real names or data.
- Location: built-in India state → city list; the state is derived from the city. **State-only is allowed** when the city is unknown. One city belongs to one state. No manual state/city management screen.
- Location inputs (filter + form) are searchable comboboxes. The form opens a nested state → cities list on focus. The filter supports full keyboard use (↑↓ Home End Enter Esc Backspace) and closes on blur/Esc without clearing the text.
- Handles always link to `instagram.com/<handle>` in a new tab.
- **Freshness:** metrics `updatedAt` changes only when an edit changes follower/engagement/likes/comments numbers. **No "mark as refreshed" button.** Tiers: ≤30d fresh (green), 31–90d ageing (amber), >90d stale (red).
- **Rates are never overwritten:** a price change saves a new dated entry; the profile shows the rate history.
- Followers filter: one dual-thumb log slider, 1K–10M (right end = 10M+).
- Category filter shows 4 + selected, with "+N more" / "Show less".
- Sidebar collapses like Claude's: toggle on the right when open, 216↔52px, 280ms, labels fade, Ctrl/Cmd+. shortcut, state persisted.
- Coming soon (disabled with a "Soon" tag): CSV import, Previous campaigns, Analytics, Outreach.

## Frontend implementation notes (from prototype)
- Use `lucide-react` for icons in production (the prototype's CSS-mask spans are a prototype workaround).
- Tables sit in `overflow-x:auto` wrappers so action columns stay reachable at narrow widths.
- Design tokens: `docs/design/design_handoff_influencer_crm/_ds/clear-street-design-system-…/colors_and_type.css` (`--cs-*` variables).
