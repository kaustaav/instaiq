# Backlog

**Open work now lives in GitHub Issues:** https://github.com/kaustaav/instaiq/issues
(labels: `priority: high|medium|low|lowest`, `type: story|task`, `area: ...`, `go-live`, `phase-2`).
Every change starts from an issue; commits reference it (`Closes #12`). Done work is in the git history and
in `docs/DEPLOYMENT.md` / `docs/DATA_MODEL.md`.

This file was the backlog until 2026-10-07; its open items became issues #1-#32. Notes worth keeping:
- Billing data lags up to ~24h; check the Credits page / Cost Explorer (before credits) for real usage.
- Never create long-lived AWS access keys: CI/CD must use GitHub OIDC -> an IAM role.
- Repo protections are on (secret scanning, push protection, Dependabot). Dependabot PRs target `main`.
