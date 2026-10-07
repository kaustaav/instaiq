# InfluenceIQ UI spec

## Overview
An internal CRM for a campaign team to discover Instagram influencers (India-focused), shortlist them into campaigns, and maintain the influencer database. Four screens: **Search & Browse**, **Influencer Profile**, **Campaigns**, **Manage Data** — plus an **Add/Edit Influencer** drawer and an **Add to Campaign** modal.

## About this document
How each screen looks and behaves, written down when the UI was first designed. The React app in `frontend/` is the source of
truth now; keep this in sync when behaviour changes. Design tokens live in `frontend/src/styles/tokens.css` (`--iq-*`).

---

## Data Model

```ts
type Influencer = {
  id: number;
  name: string;
  handle: string;            // stored with leading "@"
  cities: string[];          // 0..n — each city belongs to exactly one state
  states: string[];          // state-only entries (city unknown). Never duplicates a state already implied by a city
  cats: string[];            // niches, ≥1
  langs: string[];
  followers: number;         // required, > 0
  eng: number;               // engagement rate %
  likes: number; comments: number;
  bio: string; email: string; phone: string;
  tags: string[];            // hashtags, stored with "#"
  pricing: { story: string; reel: string; post: string };   // current = rates[0]
  rates: { date: number; story: string; reel: string; post: string }[]; // newest first, never overwritten
  updatedAt: number;         // epoch ms — when metrics were last edited
  camps: { name; brand; date; del; status: 'Completed'|'Ongoing' }[];
  av: string;                // initials
};

type Campaign = { id: number; name: string; created: string; iids: number[] }; // iids is a SET (unique)

type Location = { state: string; cities: string[] }[];  // built-in India list, see "Locations"
```

Derived: `statesOf(inf) = unique(cities.map(stateOf) ∪ inf.states)`.

---

## Business Rules (acceptance criteria)

1. **One influencer per campaign.** Adding an influencer already in a campaign is a no-op. All counts, tables and CSV export de-duplicate.
2. **Required fields on Add/Edit:** Full name, Instagram handle, ≥1 city **or** state, ≥1 niche, Followers (> 0). The first failing rule's message shows in the drawer footer (red): "Name is required", "Instagram handle is required", "Add at least one city or state", "Pick at least one niche", "Followers is required".
3. **Location:** city → state is automatic from the built-in list. The user can pick a state alone when the city is unknown. Custom city: if nothing matches, the user may add a new city under a chosen state; a city name can belong to only one state ("X already belongs to Y").
4. **Metrics freshness:** `updatedAt` changes **only** when a save changes followers / eng / likes / comments (or on create). There is intentionally **no** manual "mark as refreshed".
5. **Rate history:** if story/reel/post changed on save, prepend a new `rates` entry dated now; old entries stay. Unchanged prices keep the history as-is.
6. **Freshness tiers** (from `updatedAt`, also applied to `rates[0].date`):
   | Age | Tier | Label | Pill bg / fg / dot |
   |---|---|---|---|
   | ≤ 30 days | fresh | "Updated today" / "Updated yesterday" / "Updated N days ago" (short "Nd ago") | #E7F7EF / #005E3B / #12A363 |
   | 31–90 days | ageing | "Updated in Mon YYYY" | #FEF4E4 / #8B5E00 / #D97706 |
   | > 90 days | stale | "Stale · last updated Mon YYYY" (short "Stale · Mon YYYY") | #FDECEC / #9F1D1D / #DC2626 |
7. **Delete influencer** requires inline confirm (Delete? No / Yes) and removes them from all campaigns.
8. **Instagram links:** every handle links to `https://www.instagram.com/<handle-without-@>/`, `target=_blank rel=noopener`; clicks inside cards/rows must `stopPropagation` so the card doesn't also open the profile.
9. **Number format:** `<1000` raw; `≥1000` → K; `≥1e6` → M; one decimal below 100 (e.g. 8.4K, 1.2M, 120K). Prices in INR with Indian grouping: `₹2,000`.

---

## Screens

### App shell
- Full-height flex row: **Sidebar** + content. Body bg `--iq-gray-50`, base font 13px Manrope, text `--iq-fg-1`.
- **Sidebar** (dark `#0E0E10`, right border `#2A2A2F`): width **216px open / 52px collapsed**, transition `width 280ms cubic-bezier(0.32,0.72,0,1)`. Labels fade: opacity 1→0 in 120ms on close; 0→1 in 200ms with 90ms delay on open. Content is clipped (`overflow:hidden; white-space:nowrap`), not unmounted.
  - Header (min-height 58px, bottom border): brand "InfluenceIQ" (Manrope 800, 16px, white, -0.02em) + "INFLUENCER CRM" (10px, 500, uppercase, 0.08em, `#71717A`). Toggle button **on the right** when open (32×32, radius 6, icon `panel-left` 17px, `#A6A6AE`); when collapsed only the toggle shows. Tooltip "Close sidebar (Ctrl+.)" / "Open sidebar (Ctrl+.)". **Ctrl/Cmd + .** toggles. Persist in `localStorage['iiq-sb']`.
  - Nav items (padding 7×10, radius 6, 13px, gap 9, icon 14px): Search & Browse (`search`), Campaigns (`megaphone`, badge = campaign count), Manage Data (`database`, no badge). Active: bg `rgba(255,255,255,0.1)`, white, 600, left border 2px `#5F6CF2`. Inactive `#A6A6AE`, 400. Hover bg `rgba(255,255,255,0.07)`. Badge: 11px, bg `rgba(255,255,255,0.13)`, pill. Collapsed: `title` = label.
  - Divider, then "COMING SOON" (10px uppercase) + disabled Analytics (`bar-chart-3`) and Outreach (`send`) at 50% opacity.
  - Footer: 28px avatar circle `--iq-brand-500` "AK", "Aisha Khan" 12/500, "Campaign Manager" 11px, settings icon.

### 1. Search & Browse
Two columns: **Filter panel** (220px, white, right border, padding 14, gap 14) + **Results**.

Section labels: 10px/600 uppercase, 0.06em, `--iq-fg-3`. "Clear all" link appears when any filter is active.

- **Location** — combobox, bg `--iq-gray-50`, map-pin icon, placeholder "City or state".
  - Typing shows a dropdown (max 8) of states ("Whole state · any city", 600 weight) and cities (sub = state). Ranking: starts-with → contains → cities whose state matches; states before cities on ties.
  - Keyboard: ↑/↓ (wrap, keeps active option scrolled into view), Home/End, Enter adds the highlighted option, Esc closes the list (a second Esc clears the text), Backspace on empty input removes the last tag. Hover syncs the highlight. Blur closes the list after 120ms and keeps the text.
  - ARIA: `role=combobox`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; `role=listbox` / `role=option` / `aria-selected`.
  - Picked items render as blue pills (`--iq-brand-500`, white) "Punjab (state)" / "Pune", each with a real `<button aria-label="Remove X filter">×</button>`.
  - Matching: a state filter matches anyone whose `statesOf` includes it (including state-only influencers); a city filter matches `cities` only; multiple = OR.
- **Category** — chips (padding 3×9, 12/500, pill). Inactive `--iq-gray-100` / `--iq-fg-2`; active uses the category color pair + 1px border in its fg. Show the **first 4** plus any selected, then a dashed "+N more" / "Show less" button (`aria-expanded`).
- **Followers** — one dual-thumb slider, **1K → 10M, log scale** (position 0–1000 ↦ 10^(3+4p/1000), snapped to 2 significant digits). The thumbs cannot cross (min gap 10 steps). Min at the left end = no minimum; max at the right end = "10M+", no maximum. Header value: "Any" or "5K – 1.2M". Ticks: 1K · 10K · 100K · 1M · 10M. Track 3px `--iq-border`, fill `--iq-brand-500`, thumbs 14px blue with a 2px white border and shadow. Each thumb has `aria-label` and `aria-valuetext`.
- **Min Eng. Rate** — segmented chips Any / 3%+ / 5%+ / 7%+ (active `--iq-gray-800` / white).
- **Language** — chips, OR match.

**Results header** (white, padding 12×16): search input (name, bio, hashtag, handle; clear ×) · "N influencers" · Grid/List toggle.

**Grid** — `repeat(auto-fill, minmax(252px, 1fr))`, gap 10. Card: white, 1px border, radius 8, hover `shadow-3` and translateY(-1px).
- Top: 38px avatar (initials, color by id from `#0B7FA3,#573EBB,#141627,#007B4D,#D97706,#7C2D12,#4D6B1F`), name 13/600 with a **7px freshness dot** on the right (title = label), line "@handle (blue link) · cities/states", category badges.
- Middle: 3-column stats — Followers / Eng. Rate (`--iq-success` #00A96B) / Avg Likes (mono 13/600, labels 9px uppercase).
- Bottom: 2 hashtag chips (blue on `--iq-brand-50`), "+ Shortlist" button → Add to Campaign modal.

**List** — table: Influencer (avatar, name, handle link) · Location (cities, then states in `--iq-fg-3`) · Category · Followers · Eng. Rate · Language · "+ Shortlist". The wrapper is `overflow-x:auto`.

Empty state: search-x icon, "No influencers match" / "Try adjusting the filters".

### 2. Influencer Profile
Breadcrumb bar: "← Search Results › Name". Content max-width 1080, padding 16×20, gap 12.
- **Header card** (radius 10, padding 20×22):
  - Left: 58px avatar, name 19/600, @handle link. Location line: "City, State · State (city not known)", plus languages. Category badges.
  - Buttons: Edit (opens drawer) · View on Instagram (link) · **Add to Campaign** (primary).
  - Stats strip, 4 columns: Followers · Eng. Rate · Avg Likes · Avg Comments (mono 20/700).
  - Under it: "Metrics" + freshness pill + exact date (mono).
- **Two columns** `1fr 300px`:
  - Left: About (bio), Campaign History table (Campaign · Brand · Date · Deliverable · Status pill: Completed `#E7F7EF/#005E3B`, Ongoing `#FEF4E4/#8B5E00`).
  - Right: Contact (mail, phone) · **Pricing (INR)** with "as of Mon YYYY" colored by the rate freshness tier; Story / Reel / Post rows. If there's earlier history, a "Show rate history (N earlier)" toggle opens a table (From · Story · Reel · Post), current row first ("Mon YYYY · now"). · Top Hashtags · Notes (inline edit with Cancel/Save).

### 3. Campaigns
- **Left list** (252px): header "Campaigns" + "New". Items show name, "N influencers · created date"; active item bg `--iq-brand-50` + 2px left border blue. Pinned at the bottom: **Previous campaigns** — disabled, dashed border, history icon, "SOON" pill, `cursor:not-allowed`.
- **Right:** header with name + count/date, Share, **Export CSV** (primary). Table: # · Influencer (name opens profile, handle link) · Location · Category · Followers · Eng. Rate · Languages · Remove (red).
- **CSV columns:** Name, Handle, Instagram URL, Cities, States, Categories, Followers, Eng Rate, Languages, Reel Rate (de-duplicated rows). Filename `<campaign>.csv`.
- Empty state: "Campaign is empty" / "Add influencers from Search".

### 4. Manage Data
Header: "Manage data" + "N influencers · N with stale metrics". Buttons: **Import CSV** (disabled, dashed, "SOON" pill, tooltip "CSV import is coming soon") and **Add influencer** (primary, `user-plus`).
- Toolbar: search (name/handle) + freshness filter chips "All N · Fresh N · Ageing N · Stale N", each with a colored dot; active chip `--iq-gray-800`.
- Table: Influencer · Cities ("Not known" in `--iq-fg-3` if none) · States · Niches · Languages · Followers · **Last updated** (pill with short label + "Rates: Mon YYYY") · actions (edit pencil, red trash → inline confirm).

### Add / Edit Influencer drawer
Right-side drawer, 560px, full height, overlay `rgba(0,0,0,0.38)` (click outside closes). Title "Add influencer" / "Edit influencer". Footer: error text · Cancel · primary "Add influencer" / "Save changes". Section labels 10px uppercase.

Placeholders are **generic**, never real data: "Full name", "handle", "Email address", "Phone number", "0", "0.0", "₹", "#hashtag, #hashtag".

- **Basics** (2-column grid): Full name *, Instagram handle * (with "@" prefix adornment), Email, Phone.
- **Location *** — "Search a city or a state. If you only know the state, pick the state on its own."
  - Selected items show as tags: "Pune Maharashtra ×" / "Punjab any city ×".
  - On **focus** (before typing) a nested list opens: each state is a bold row on a shaded bg (`--iq-gray-25`), hint "Select whole state" / "N selected" / "✓ Whole state". Its cities are indented 28px underneath, with ✓ and a blue-50 bg when picked. Clicking toggles and keeps the list open (use `onMouseDown` + `preventDefault`).
  - Typing filters it: a matching state keeps all its cities; otherwise only matching cities show.
  - When there are fewer than 3 matches and no exact one: "Can't find 'X'? Add it under a state:" + state `<select>` + "Add city".
  - Enter picks the top match; Esc closes.
- **Niches *** — category chips (toggle) + "Add a new niche" input.
- **Languages** — chips + "Add a new language".
- **Metrics** (4 columns, mono inputs): Followers *, Eng. rate %, Avg likes, Avg comments. The section header shows the current freshness label ("Will be dated today" for new).
- **Pricing (INR)** (3 columns): Story, Reel, Post. Header: "Current since Mon YYYY · edits save as a new rate".
- **Profile:** Bio (textarea), Top hashtags (comma separated; "#" auto-added).

### Add to Campaign modal
360px centered, radius 10, `shadow-4`. Title "Add to Campaign" + influencer name. One row per campaign (name, "N influencers"); pill "✓ Added" (blue on blue-50) or "Add" (outlined). Clicking toggles membership. "Done" closes. Clicking the overlay closes.

---

## Locations
The built-in list covers all 28 states + 8 UTs of India with ~230 major cities (see `GEO` in `frontend/src/data/seed.ts`). State names are official: "Delhi", "Chandigarh", "Jammu and Kashmir", etc. When a city and its state share a name (Chandigarh, Delhi, Puducherry), don't print it twice.
**Production:** replace this with a real source (e.g. India Post pincode data / GeoNames / a Places API), keeping the same `{ state, cities[] }` interface and the one-city-one-state rule.

## State (client)
Screen and selected influencer id; search query; `locF[]`, `cF[]`, `lF[]`, `fMin`, `fMax`, `eMin`; category "show more"; grid/list view; the active campaign; modal influencer id; form draft + error; Manage search, freshness filter and pending-delete id; sidebar open; rate-history open; profile note draft.

## Design Tokens
Colors:
- Brand cyan: 50 `#E8F7FC` · 400 `#11A6D2` (the brand cyan: accents, chart fills, focus) · **500 `#0B7FA3` (primary: buttons, links; white text passes WCAG AA)** · 600 `#096A88` (primary hover)
- Navy `#141627` (sidebar, mobile bar, selected chips) · Accent lime `#8CC641` (small highlights such as the active nav marker; never text on white)
- Gray: 0 `#FFFFFF` · 25 `#FAFAFA` · 50 `#F4F4F5` · 100 `#E8E8EA` · 200 `#D4D4D8` · 300 `#A6A6AE` · 400 `#71717A` · 600 `#3F3F46` · 800 `#18181B` · 900 `#0E0E10`
- Text: fg-1 `#0E0E10` · fg-2 `#3F3F46` · fg-3 `#71717A`
- Border `#E8E8EA`
- Dark (on navy): border `#262A42` · fg-1 `#F4F5FA` · fg-2 `#A9AEC7` · fg-3 `#737896`
- Success `#00A96B` · Danger `#E5484D`

Category pairs (bg / fg):
- Jewellery `#E9EAF2`/`#141627`
- Fashion `#EEE9FF`/`#3D2F99`
- Beauty `#FEF4E4`/`#8B5E00`
- Food `#E7F7EF`/`#005E3B`
- Fitness `#E4F3F8`/`#1A6480`
- Travel `#E4F5F4`/`#1A7070`
- Lifestyle and any custom niche `#F4F4F5`/`#3F3F46`

Typography: Sans **Manrope** (the wordmark uses Manrope 800); Mono **JetBrains Mono** (all numbers and prices). Sizes in use: 9, 10, 11, 12, 13 (base), 14, 16, 19, 20.

Radius: 4 (small buttons and tags) · 6 (buttons, inputs) · 8 (cards, tables) · 10 (profile header, modal) · 999 (pills).

Shadows:
- shadow-3 `0 8px 24px rgba(14,14,16,.08), 0 2px 6px rgba(14,14,16,.04)` (card hover, dropdowns)
- shadow-4 `0 24px 64px rgba(14,14,16,.14), 0 4px 12px rgba(14,14,16,.06)` (modal, drawer)

Motion: ease-out `cubic-bezier(0.22,1,0.36,1)` for card hover (180ms); sidebar `cubic-bezier(0.32,0.72,0,1)` 280ms.

## Assets
- Icons: Lucide (`lucide-react` in production). Used: search, megaphone, database, bar-chart-3, send, settings, panel-left, layout-grid, list, x, search-x, plus, arrow-left, chevron-right, map-pin, languages, pencil, external-link, bookmark-plus, mail, phone, share-2, download, trash-2, bookmark, history, upload, user-plus, check, refresh-cw.
- Fonts: Manrope and JetBrains Mono (SIL Open Font License), loaded from the fontsource packages on jsdelivr.
- No imagery. Avatars are initials.

## Out of scope / Coming soon
CSV import · Previous campaigns · Analytics · Outreach · "New" campaign and "Share" buttons (visual only). Backend, auth and persistence are not designed.
