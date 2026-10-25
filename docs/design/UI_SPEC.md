# InfluenceIQ UI spec

## Overview
An internal CRM for a campaign team to discover Instagram influencers (India-focused), run them through campaigns, and
maintain the influencer database. Four screens: **Search & Browse**, **Influencer Profile**, **Campaigns** (list and
detail), **Manage Data**; plus drawers (add/edit influencer, campaign form, campaign member, niches & languages) and
dialogs (add to campaign, confirmations).

## About this document
How each screen looks and behaves. The React app in `frontend/` is the source of truth; keep this in sync when looks or
behaviour change. Design tokens live in `frontend/src/styles/tokens.css` (`--iq-*`), tag colours in
`frontend/src/lib/palette.ts`. The data model is in [docs/DATA_MODEL.md](../DATA_MODEL.md).

---

## Design language (since 2026-10-25)
The look of a Mac app (Mail, Notes, Finder) with apple.com's polish, applying Apple's fluid-interface principles:
respond on press, move on springs, enter and leave along the same path, follow the finger, respect accessibility settings.

- **Type:** the system font: San Francisco on Apple devices, Inter (open licence, from fontsource) elsewhere. Numbers
  use tabular figures in the same font, not a code font. Large titles are bold with tight tracking (26–28px, −0.022em);
  body 13px near 0 tracking; labels are sentence case, never ALL CAPS. Nothing below 11px (10px only in "Soon" pills).
- **Surfaces:** page `#F5F5F7`; white cards, radius 14, no border, soft shadow (`--iq-shadow-1`); sheets and dialogs radius 16.
- **Colour:** Apple blue `#0071E3` for primary buttons, selection and focus; links `#0066CC`. Status and tags use Apple's
  system colours as soft tints with darker text (every pair ≥ 4.5:1). Dark pill (`#1D1D1F`, white text) for selected
  multi-select filters.
- **Materials:** frosted toolbars and sidebar (`backdrop-filter: saturate(180%) blur(20px)`); content scrolls underneath
  and a hairline appears only once it does.
- **Controls:** pill buttons (blue primary, grey secondary, plain); App Store-style tinted button for "+ Shortlist";
  segmented controls (grey track, white thumb that slides on a spring) for single-choice filters; grey-filled search
  fields with a round clear button; macOS focus halo (`--iq-focus`).
- **Motion:** critically damped springs (no bounce) for anything opened by a click; a little bounce only after a flick.
  Pressed states show on pointer-down (buttons scale to 97%).
- **Page structure:** list pages (Campaigns, Manage) have a large title, then a frosted toolbar (search, filters) that
  pins once the title scrolls away. Detail pages (a campaign, a profile) have a frosted page bar: "‹ Back" on the left,
  the main action and a ••• menu on the right, and the page's name fading into the bar once its large title scrolls away.
- **One main action, the rest in •••:** a single blue button for the natural next step; secondary and destructive
  actions in a ••• menu (destructive last, in red).
- **Forgiveness over confirmation:** reversible actions happen at once with an Undo notice (archive); only
  irreversible ones ask first (demo delete, cancelling a campaign).
- **Accessibility settings:** Reduce motion (no slides or scaling; cross-fades; still skeletons), Reduce transparency
  (frosted surfaces become solid), Increase contrast (cards get defined edges).

---

## Business Rules (acceptance criteria)

1. **One influencer per campaign.** Adding an influencer already in a campaign is a no-op. All counts, tables and CSV export de-duplicate.
2. **Required fields on Add/Edit:** Full name, Instagram handle, ≥1 city **or** state, ≥1 niche, Followers (> 0). The first failing rule's message shows in the drawer footer (red): "Name is required", "Instagram handle is required", "Add at least one city or state", "Pick at least one niche", "Followers is required".
3. **Location:** city → state is automatic from the built-in list. The user can pick a state alone when the city is unknown. Custom city: if nothing matches, the user may add a new city under a chosen state; a city name can belong to only one state ("X already belongs to Y").
4. **Metrics freshness:** `updatedAt` changes **only** when a save changes followers / eng / likes / comments (or on create). There is intentionally **no** manual "mark as refreshed".
5. **Rate history:** if story/reel/post changed on save, prepend a new `rates` entry dated now; old entries stay. Unchanged prices keep the history as-is.
6. **Freshness tiers** (from `updatedAt`, also applied to `rates[0].date`):
   | Age | Tier | Label | Pill (tone / dot) |
   |---|---|---|---|
   | ≤ 30 days | fresh | "Updated today" / "Updated yesterday" / "Updated N days ago" (short "Nd ago") | green / `#34C759` |
   | 31–90 days | ageing | "Updated in Mon YYYY" | orange / `#FF9500` |
   | > 90 days | stale | "Stale · last updated Mon YYYY" (short "Stale · Mon YYYY") | red / `#FF3B30` |
7. **Removing an influencer:** demo mode deletes (inline confirm "Delete? No / Yes"); API mode never deletes, it archives (hidden from search, history kept).
8. **Instagram links:** every handle links to `https://www.instagram.com/<handle-without-@>/`, `target=_blank rel=noopener`; clicks inside cards/rows must `stopPropagation` so the card doesn't also open the profile.
9. **Number format:** `<1000` raw; `≥1000` → K; `≥1e6` → M; one decimal below 100 (e.g. 8.4K, 1.2M, 120K). Prices in INR with Indian grouping: `₹2,000`.

---

## Screens

### App shell
- Full-height row: **Sidebar** + content. Page `#F5F5F7`, base 13px.
- **Sidebar**: light frosted source list, **216px open / 52px collapsed**, `width 280ms cubic-bezier(0.32,0.72,0,1)`. Labels fade (out 120ms on close; in 200ms after 90ms on open); content is clipped, not unmounted. **Ctrl/Cmd + .** toggles; state persisted in `localStorage['iiq-sb']`.
  - Header: 26px app icon (the favicon) + "InfluenceIQ" (15/700) + "Influencer CRM" (11px grey). Toggle on the right; when collapsed only the toggle shows.
  - Items (32px high, radius 8, 13/500, icons 16px in Apple blue): Search & Browse, Campaigns (grey count of open campaigns, hidden until loaded), Manage Data. Active: grey fill, 600.
  - "Coming Soon" section header, then disabled Analytics and Outreach.
  - Footer: avatar (Google photo, or grey Contacts-style monogram) + name + email/role; sign-out button in API mode.
- **Phones (≤ 768px):** frosted top bar (menu button, "InfluenceIQ"); the sidebar becomes a 280px off-canvas menu that slides in on a spring; swipe left to close (the dim layer fades with the finger).

### 1. Search & Browse
Two columns: **Filters** (236px, on the page colour) + **Results**.

- Filters header "Filters" (h3) with "Clear all" when any filter is active.
- **Location** — white combobox, map-pin icon, placeholder "City or state".
  - Typing shows a menu (max 8) of states ("Whole state · any city", 600) and cities (sub = state). Ranking: starts-with → contains → cities whose state matches; states before cities on ties. The keyboard-highlighted option is white on blue, like a macOS menu.
  - Keyboard: ↑/↓ (wrap, keeps the active option in view), Home/End, Enter adds, Esc closes the menu (a second Esc clears the text), Backspace on empty removes the last tag. Hover syncs the highlight. Blur closes after 120ms and keeps the text.
  - ARIA: `role=combobox`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; `role=listbox` / `role=option` / `aria-selected`.
  - Picked items are blue pills "Punjab (state)" / "Pune", each with a real `<button aria-label="Remove X filter">×</button>`.
  - Matching: a state matches anyone whose states include it (including state-only influencers); a city matches `cities` only; multiple = OR.
- **Category** — white pills; selected uses the category tint with a 1.5px inset ring in its text colour. Shows the **first 4** plus any selected, then a "+N more" / "Show less" link (`aria-expanded`).
- **Followers** — one dual-thumb slider, **1K → 10M, log scale** (position 0–1000 ↦ 10^(3+4p/1000), 2 significant digits); thumbs can't cross. Left end = no minimum, right end = "10M+". Header "Any" or "5K – 1.2M". macOS look: 4px track, blue fill, 20px white thumbs with a shadow. Each thumb has `aria-label` and `aria-valuetext`.
- **Minimum engagement** — segmented control Any / 3%+ / 5%+ / 7%+ (full width).
- **Language** — white pills (selected: dark pill), OR match.

**Results**: a frosted toolbar pinned at the top (search field 14px with round clear button; "Add all to campaign"; grid/list segmented control), results scroll underneath. Then the heading **"Influencers"** with "N results".

**Grid** — `repeat(auto-fill, minmax(280px, 1fr))`, gap 16. Card: white, radius 14, soft shadow; hover lifts 2px with a larger shadow; press scales to 99%.
- Top: 44px avatar (initials on a system colour, `AVATAR` in `palette.ts`, with a soft top light), name 15/600 with a 7px freshness dot (title = label), "@handle · cities/states", category tags.
- Stats tile (grey, radius 10): Followers · Eng. Rate (green) · Avg Likes, numbers 15/600, labels 11px.
- Footer: up to 2 hashtags as blue text, **"+ Shortlist"** tinted pill → Add to campaign dialog.

**List** — table: Influencer · Location · Category · Followers · Eng. Rate · Language · "+ Shortlist", in an `overflow-x:auto` wrapper.

**Phones**: the toolbar wraps; a "Filters" button opens the filters as a full-screen sheet that springs up from the bottom, with an iPhone grab handle. Swipe down to close: from the header always, inside the list only when it's scrolled to the top (otherwise it scrolls). "Show N influencers" closes it.

Empty state: "No influencers match" / "Try adjusting the filters".

### 2. Influencer Profile
Page bar: "‹ Search Results" (or wherever you came from), the name once it scrolls away, **Edit** (pencil only on
phones), **Add to Campaign**, and with the backend a ••• menu of status changes (Mark active / Put on hold… /
Archive… / Ban…, each but Active asks for a reason). Content max-width 1080.
- **Hero** (no card): 76px avatar, name (30/700), @handle link, location ("City, State · State (city not known)") and
  languages, niche tags, then contact buttons as in Contacts: **Instagram ↗** (tinted, opens a new tab), Email, Call
  (greyed out with a tooltip when missing). A status note shows when they aren't active.
- **Metrics** card: Followers · Eng. Rate · Avg Likes · Avg Comments in soft tiles; freshness pill and date in the header.
- **Two columns** `1fr 320px`:
  - Left: About; **Campaigns** as one list (campaign link, brand and date; stage and "n/m posted" on the right), then
    "Before InfluenceIQ" collaborations.
  - Right: Contact (mailto / tel links) · Pricing with "as of Mon YYYY" coloured by rate freshness and a rate-history
    panel · Top hashtags · Notes (Edit → Cancel / Save).

### 3. Campaigns
- **List** (kept light on purpose, see CLAUDE.md): large title "Campaigns" + "N active · N draft", **New campaign**.
  Pinned toolbar: search (campaign or brand), status segmented control (All · Draft · Active · Completed · Cancelled ·
  Archived; scrolls sideways on phones), brand pop-up button. Rows, Mail-style: name + status pill, brand · dates, ›.
  No counts or progress here: those are on each campaign's page.
- **Detail**: page bar with "‹ Campaigns", the main action (Activate / Mark completed / Reopen / Unarchive) and •••
  (Edit campaign, Duplicate, Export CSV, then Archive or **Cancel campaign** in red). Large title with status, brand and
  dates. **Targets** card: tiles per measure (big number, "of target", bar, note: %, "All paid", "Over by ₹…" in red).
  **Brief** card. **Influencers** heading with count and "Add influencers"; stage filter pills; members table
  (Influencer · Stage · Deliverables · Fee · Payment). A row opens the member drawer.
- **Member drawer** (grouped): header with avatar, name (links to the profile), handle and campaign. A summary card:
  stage + **the next step in words** ("1 draft to review", "Next: agree terms", "All posted. Next: record payment",
  "All done"…), when and by whom the stage changed, and the stage buttons. Then Agreed terms (or Agree terms with a
  Paid / Barter / Paid + product segmented control), Deliverables (one list, actions per deliverable), Payment (status,
  paid of fee, payments list with Receipt ↗, record or write off), Notes, and **Remove from campaign** as a red row.
- Status changes that aren't allowed yet open a dialog listing every reason.

### 4. Manage Data
Large title "Manage data" + "N influencers · N with stale metrics"; **Add influencer** and ••• (Niches & languages,
Import CSV with a "Soon" tag, disabled).
- Pinned toolbar: search (name/handle) + freshness segmented control "All · Fresh · Ageing · Stale" with dots and counts.
- Table: Influencer · Location (cities, then states not already shown as a city) · Niches · Languages · Followers ·
  Updated (pill) · ••• (Edit, View profile, then Archive with the backend or Delete in demo). Clicking a row opens the
  profile. Archive is immediate with an Undo notice; demo Delete asks first (it can't be undone).

### Drawers and dialogs
- One shared overlay (`components/Overlay.tsx`): a dim layer that fades (`rgba(0,0,0,0.24)`, click to close) and the panel above it.
- **Drawers**: floating sheets inset 8px from the window edges, radius 16, full screen on phones. Title 17/700, round grey close button, footer on a faint grey. They spring in from the right and leave the same way; Esc, ✕ or clicking outside closes. **On touch screens, swipe right to close**: the drawer follows the finger; a flick closes even if short, a slow short drag springs back.
- **Dialogs**: centered, radius 16, scale up from 95% on a spring and fade out quickly.
- Focus moves into the panel when it opens and back to whatever opened it when it closes. Closing mid-animation reverses smoothly.
- **Forms are grouped** (iPhone Settings style): grey body, each part a white rounded card with a title and an
  optional note. Influencer form: Basics, Location, Niches, Languages, Metrics, Pricing, Profile. Campaign form:
  Campaign, Dates, Targets, Budget. Niches & languages: one card each (names only, with Rename and Delete; deleting
  one that's in use is refused with "rename or merge it instead").

**••• menus** (`components/Menu.tsx`): float above the page (never clipped by a table), grow out of their button,
open upwards near the bottom of the screen, close on scroll. One highlight, white on blue, that follows mouse or keyboard
(↑↓ Home End, Enter, Esc / Tab closes and returns focus to the button).

**Notices** (`lib/notify.ts`, shown by `components/Toasts.tsx`): small frosted cards that spring up at the bottom;
successes clear after ~4s (6s with Undo), errors after 7s or ✕; at most three; announced to screen readers. No
browser alert / prompt / confirm anywhere.

**Add / Edit influencer drawer** (560px). Placeholders are **generic**, never real data: "Full name", "handle", "Email address", "Phone number", "0", "0.0", "₹", "#hashtag, #hashtag".
- **Basics** (2 columns): Full name *, Instagram handle * ("@" prefix), Email, Phone.
- **Location *** — "Search a city or a state. If you only know the state, pick the state on its own." Tags "Pune Maharashtra ×" / "Punjab any city ×". On focus a nested list opens: each state a bold row on a shaded background with "Select whole state" / "N selected" / "✓ Whole state", its cities indented underneath. Typing filters it; fewer than 3 matches and no exact one offers "Can't find 'X'? Add it under a state". Enter picks the top match; Esc closes.
- **Niches *** and **Languages** — pills + "Add a new …" field.
- **Metrics** (4 columns): Followers *, Eng. rate %, Avg likes, Avg comments; header shows the freshness label ("Will be dated today" for new).
- **Pricing (INR)** (3 columns): Story, Reel, Post; edits save as a new dated rate.
- **Profile**: Bio, Top hashtags (comma separated; "#" auto-added).

**Add to campaign dialog** (420px): one row per open campaign (name, brand, count, status); "Add" / "✓ Added" (click to undo while still untouched) / "In campaign · Stage". "Manage campaigns" link, "Done".

### Loading
**Skeleton screens** (`components/Skeletons.tsx`) instead of "Loading…" text: grey shapes in the layout of the real content
(search cards and rows, profile, campaign list and detail, Manage, small lists in dialogs) with a soft shimmer. They
reuse each screen's layout so content lands where the shapes were, appear only after ~160ms (no flash on fast loads),
stay still with Reduce motion, and screen readers hear one "Loading …" message. Later loads keep the current content,
dimmed, instead of blanking it.

### Sign-in (API mode)
Centred white card (radius 22) on a soft gradient: 72px app icon, "Sign in to InfluenceIQ", "Use your company Google
account.", Google's sign-in button. The card fades up gently on load.

---

## Locations
The built-in list covers all 28 states + 8 UTs of India with ~230 major cities (see `GEO` in `frontend/src/data/seed.ts`). State names are official: "Delhi", "Chandigarh", "Jammu and Kashmir", etc. When a city and its state share a name (Chandigarh, Delhi, Puducherry), don't print it twice.
**Production:** replace this with a real source (e.g. India Post pincode data / GeoNames / a Places API), keeping the same `{ state, cities[] }` interface and the one-city-one-state rule.

## Design Tokens
In `frontend/src/styles/tokens.css`:
- **Accent**: brand-500 `#0071E3` (buttons, selection, focus) · 600 `#0077ED` (hover) · 700 `#006EDB` (pressed) · 50 `#EEF5FE` (tints) · link `#0066CC`.
- **Neutrals**: page `#F5F5F7` · fill `#E8E8ED` · `#D2D2D7` · `#AEAEB2` · `#86868B` · text `#1D1D1F` / `#424245` / `#6E6E73` · hairline `#E5E5EA` · grey fills `rgba(118,118,128,0.12)`.
- **Status**: success `#1C7F38` · warning `#C25400` · danger `#D70015`.
- **Tag tones** (`lib/palette.ts`, soft tint / text): gray, muted, blue, indigo, purple, teal, orange, green, red, pink. Categories: Jewellery indigo · Fashion purple · Beauty pink · Food orange · Fitness green · Travel teal · Lifestyle and custom niches gray.
- **Shape**: radius 6 (dense tags) · 8 (inputs) · 14 (cards, tables) · 16 (sheets, dialogs) · 999 (pills and buttons).
- **Elevation**: `--iq-shadow-1` (cards) · `--iq-shadow-3` (hover, menus) · `--iq-shadow-4` (sheets, dialogs) · `--iq-focus` (focus halo).
- **Materials**: `--iq-material-bar`, `--iq-material-side`, `--iq-blur`.
- **Motion**: `--iq-ease-out`; `--iq-spring` (a critically damped spring sampled for CSS, used with 450ms). Drawers and dialogs use Motion springs (`bounce: 0`); swipe releases carry the finger's velocity.

## Assets
- Icons: Lucide (`lucide-react`).
- Fonts: the system font; Inter (SIL Open Font License) from fontsource as the fallback. Never copy font files or design-system code from other websites into this repo.
- App icon: `frontend/public/favicon.svg` (rounded square, blue gradient, "IQ"), also used in the sidebar and on sign-in.
- No imagery. Avatars are initials (or the Google photo for the signed-in user).

## Out of scope / Coming soon
CSV import · Previous campaigns · Analytics · Outreach · dark mode (#48).
