#!/usr/bin/env bash
# Post-deploy smoke test for the static UI.
#   scripts/smoke-test.sh https://main.d360lwuskrbgul.amplifyapp.com
#   scripts/smoke-test.sh https://kaustaav.github.io/instaiq --pages   (GitHub Pages: deep links are served with 404 + the app)
# Exits non-zero if anything a user or a monitor would notice is broken.
set -uo pipefail

BASE="${1:?usage: smoke-test.sh <base-url> [--pages]}"
BASE="${BASE%/}"
PAGES="${2:-}"
FAIL=0

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=1; }

# check <path> <expected status> <grep pattern the body must contain>
check() {
  local path="$1" want="$2" pattern="$3" body code
  body="$(curl -s -w '\n%{http_code}' "$BASE$path")"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [[ "$code" == "$want" ]] && grep -q "$pattern" <<<"$body"; then
    pass "$path → $code"
  else
    fail "$path → $code (expected $want containing '$pattern')"
  fi
}

echo "Smoke test: $BASE"

echo "Pages"
check / 200 '<title>InfluenceIQ'
# GitHub Pages can't rewrite, so deep links come back as 404.html (a copy of the app)
DEEP=200; [[ "$PAGES" == "--pages" ]] && DEEP=404
for p in /search '/search?cat=Jewellery&loc=city:Chandigarh' /influencers/1 /campaigns/1 /manage; do
  check "$p" "$DEEP" '<title>InfluenceIQ'
done

echo "Assets"
check /favicon.svg 200 '<svg'
JS="$(curl -s "$BASE/" | grep -o '/[^"]*assets/index-[A-Za-z0-9_-]*\.js' | head -1)"
if [[ -n "$JS" ]]; then
  # JS is referenced with the full base path, so request it from the origin
  ORIGIN="$(sed -E 's#(https?://[^/]+).*#\1#' <<<"$BASE")"
  check_js="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$ORIGIN$JS")"
  [[ "$check_js" == 200\ *javascript* ]] && pass "$JS → $check_js" || fail "$JS → $check_js"
else
  fail "no JS bundle referenced from index.html"
fi

if [[ "$PAGES" != "--pages" ]]; then
  echo "Headers"
  HDRS="$(curl -sI "$BASE/" | tr -d '\r')"
  for h in Strict-Transport-Security X-Content-Type-Options X-Frame-Options Content-Security-Policy Referrer-Policy; do
    grep -qi "^$h:" <<<"$HDRS" && pass "$h" || fail "$h missing"
  done
  ASSET_CC="$(curl -sI "$ORIGIN$JS" | tr -d '\r' | grep -i '^cache-control:' | cut -d' ' -f2-)"
  [[ "$ASSET_CC" == *immutable* ]] && pass "assets cached immutably ($ASSET_CC)" || fail "assets Cache-Control: ${ASSET_CC:-none}"
fi

echo
if [[ $FAIL -eq 0 ]]; then echo "All checks passed."; else echo "Some checks FAILED."; fi
exit $FAIL
