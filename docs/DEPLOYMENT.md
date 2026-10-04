# Deployment runbook

The UI is a static site (no server, no database yet), deployed to two places.

| Environment | URL | Deploys | Config lives in |
|---|---|---|---|
| **AWS Amplify** `main` (client demo) | https://main.d360lwuskrbgul.amplifyapp.com | On push to `main` (**auto-build disabled during the demo freeze**) | `amplify.yml`, `customHttp.yml`, plus one console-only rewrite rule (below) |
| AWS Amplify `develop` (testing) | https://develop.d360lwuskrbgul.amplifyapp.com | Automatically on every push to `develop` | Same app settings as `main`; **password-protected** (Hosting -> Access control). No `VITE_API_URL` yet = demo-data mode |
| GitHub Pages (public demo) | https://kaustaav.github.io/instaiq/ | Manually (see below) | `frontend` script `build:pages` |

AWS account notes: Free plan (credits, cannot be charged). Region **ap-southeast-2 (Sydney)**. The account is assigned that
region; other regions need "advanced features" (check what that does to the Free plan before enabling). App ID `d360lwuskrbgul`,
app name `influencerIq`.

## How an Amplify deploy works
1. `git push` to `main`.
2. Amplify clones the repo and runs `amplify.yml` in `frontend/`: Node from `.nvmrc` → `npm ci` → lint → `npm run build`.
3. If any step fails, nothing is deployed; the site stays on the previous build.
4. `frontend/dist/` is published to Amplify's CDN (CloudFront) with the headers from `customHttp.yml`.
5. Verify: `scripts/smoke-test.sh https://main.d360lwuskrbgul.amplifyapp.com`

Watch a build: Amplify console → app → branch `main` → the latest build → logs per phase.

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

## Teardown
Amplify console → app → App settings → General settings → **Delete app**. Removes hosting, builds and the URL.
Also revoke the Amplify GitHub App if it's no longer needed: GitHub → Settings → Applications → AWS Amplify.

## Cost
Static hosting of ~0.8 MB: fractions of a cent per month. Builds: ~1–2 minutes each, taken from Free plan credits.
Don't enable the Amplify firewall (AWS WAF): it is billed monthly.
