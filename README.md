# InfluenceIQ — Influencer CRM

Internal tool for an influencer marketing agency: keep Instagram micro/nano influencers in one place, search and filter
them, and run campaigns (shortlist → contact → negotiate → content → payment) with targets, budgets and CSV export.

**Status:** in use. The frontend and backend are both built and deployed on AWS with Google sign-in. Open work is tracked in
[GitHub Issues](https://github.com/kaustaav/instaiq/issues).

## Layout
| Path | What |
|---|---|
| `backend/` | Spring Boot 4 API (Java 21), PostgreSQL, Flyway migrations, Google sign-in |
| `frontend/` | React 19 + TypeScript + Vite. Runs against the API, or on built-in demo data with no backend ([details](frontend/README.md)) |
| `deploy/` | Server scripts for AWS (EC2 + Docker) |
| `docs/` | [Deployment and operations](docs/DEPLOYMENT.md), [data model](docs/DATA_MODEL.md), [UI spec](docs/design/UI_SPEC.md), [handover plan](docs/HANDOVER.md) |

## Run it locally

**Quickest: the UI alone on demo data.** Needs Node (version in `frontend/.nvmrc`).
```bash
cd frontend && npm ci && npm run dev    # http://localhost:5173
```

**The whole app: database + API + UI.** Also needs Docker and JDK 21 (Maven is not needed; `mvnw` downloads it).
```bash
# from the repo root
cp .env.example .env                    # local settings; fill in the Google sign-in values
docker compose up -d                    # Postgres on localhost:5433

# terminal 1
cd backend && ./mvnw spring-boot:run    # API on :8080; check: curl localhost:8080/actuator/health

# terminal 2
cd frontend && cp .env.example .env.local   # uncomment VITE_API_URL and VITE_GOOGLE_CLIENT_ID
npm run dev
```
`.env` and `frontend/.env.local` are git-ignored: never commit them.

## Deploy
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). CI (`.github/workflows/ci.yml`) runs the backend tests and the frontend
lint and build on every push.
