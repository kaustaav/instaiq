# Clear Street Design System

A design system for **Clear Street** — a cloud-native financial-technology and prime-brokerage firm modernizing the brokerage ecosystem. This system captures the visual, typographic, tonal and component foundations used across `clearstreet.io`, the **Clear Street Studio™** platform, and related product surfaces so agents and designers can produce on-brand artifacts quickly.

> **Mission:** Give every sophisticated investor access to every asset, in every market, through a unified platform built for speed, transparency and scale.

---

## Sources used to build this system

This project was built from publicly available Clear Street materials (no codebase or Figma was attached). Sources:

- `https://clearstreet.io` — marketing site (homepage, Studio, Clients, Services)
- `https://studio.clearstreet.io` — Studio product surfaces (references)
- `https://docs.clearstreet.io/studio/docs/getting-started` — API reference
- Büro agency case study — `burocratik.com/work/clear-street` (palette: Blueberry blue for institutional content, dark tones for product, 3D / airline-inspired pictograms)
- Clear Street LinkedIn + press releases (voice, tone, leadership bios)
- Clear Street Studio iOS app — App Store listing

> **Caveat:** Since no internal assets were attached, this system is built from externally-visible marketing + product surfaces. Fonts are approximations (closest Google Fonts match) and logos are geometric recreations; real brand files should replace these before production use. See **Open Questions** below.

---

## Products in scope

Clear Street operates three primary customer-facing surfaces:

1. **Marketing website** — `clearstreet.io`. Dense, editorial, 3D + video hero treatments. Büro-crafted. Blueberry-blue heavy, full-bleed imagery.
2. **Clear Street Studio™** — the flagship portfolio-management / trading / risk platform. Web-first (`app.clearstreet.io`), desktop + iOS apps. Dense dark-mode trading UI with a widget-based, composable-dashboard direction.
3. **Docs & API portal** — `docs.clearstreet.io`. Developer-facing; REST + WebSocket reference.

Supporting surfaces: Clear Street Studio mobile (iOS), Active Trading (formerly CenterPoint Securities), Financing Portal, Clear Street Digital, Investment Banking materials.

---

## Index

| File | Purpose |
| --- | --- |
| `README.md` | This file — context, fundamentals, index |
| `SKILL.md` | Agent/Claude Code skill manifest |
| `colors_and_type.css` | CSS vars for colors, typography, spacing, radii, shadow, motion |
| `assets/logo/` | Shield mark + wordmark (SVG, recreated) |
| `assets/images/` | Marketing imagery, pictograms, CDN references |
| `assets/icons/` | Icon conventions + substitute set |
| `preview/` | Cards registered for the Design System tab |
| `ui_kits/website/` | Marketing site UI kit (homepage, clients, services) |
| `ui_kits/studio/` | Clear Street Studio product UI kit (dashboard, blotter, risk, dark mode) |

---

## Content Fundamentals

Clear Street speaks with the confidence and restraint of an institutional capital-markets firm while signalling modernity and engineering credibility. Copy is **editorial, declarative, and evidence-heavy**.

### Voice pillars

- **Institutional but technology-forward.** Every claim reads like it was written for a CIO who also appreciates that the firm ships 6,000 production releases a year. No startup cuteness; no legacy-finance stiffness.
- **Confident, never hype-y.** "Modernizing the brokerage ecosystem." "A technology-driven platform designed for today's complex, global market." Never "revolutionary AI-powered next-gen."
- **Concrete numbers carry the argument.** `~$28.4bn notional / day`, `~550mm shares / day`, `94% YoY transacted growth`, `$1.0bn capital raised`. Specific, tabular-looking, comma-less where they look sharper (`550mm`, `16bn`).

### Tone & casing

- **Sentence case** for most headings on the product side; **Title Case** is reserved for proper nouns and product names (`Clear Street Studio™`, `Financing Portal`, `Risk Management System`).
- **"We"** for the firm, **"our clients"** or **"you"** for the audience. Third-person for press.
- **Trademark is present.** `Clear Street Studio™`, `Sophisticated Investors.™` — use the ™ mark where appropriate.
- **Crisp, short sentences mixed with one long editorial one.** Variety is intentional.

### Emoji & exclamation

- **No emoji.** Ever, in marketing or product. This is a regulated broker-dealer.
- **No exclamation points** in product copy. Rare in marketing, only for genuine milestones.

### Sample phrasings (good)

- "Speed, Transparency and Scale for Sophisticated Investors.™"
- "The all-in-one portfolio management system designed for your growth."
- "Direct transparency to the same data that our risk team sees intraday."
- "Revolutionary portfolio, trading and risk management to drive alpha and power decision-making."
- "Built for Multi-Asset Clearing" / "Designed for the Future"

### Sample phrasings (avoid)

- "Unlock 🚀 next-gen finance!"
- "Our bleeding-edge AI empowers traders"
- "Sign up now — it's totally free"

### Numbers & data

- Prefer compact forms: `$1.0bn`, `~$16bn`, `94% YoY`, `550mm shares / day`.
- Use `~` for approximates, `>` for "more than".
- Use `/` to denote a rate: `6,000 releases/year`, `shares / day`.
- Tabular numerals always for any financial data (`font-variant-numeric: tabular-nums`).

---

## Visual Foundations

### Color

- **Blueberry `#2E21DE`** is the single accent institutional color. Used for CTAs, links, brand surfaces, Studio accent, data viz primary. Saturated, unapologetic — a direct nod to Yves Blueberry.
- **Monochrome neutrals.** Cool-neutral grays (`#F4F4F5` → `#0E0E10`) scaffold everything. No warm grays.
- **Dark product surfaces.** Studio defaults to dark (`#0E0E10` / `#18181B`) — classic trading-platform look. Marketing uses predominantly white + black with Blueberry accents.
- **Semantic finance colors.** Green `#00A96B` for gains, red `#E5484D` for loss, amber `#E8A317` for warn. These only appear in product surfaces — not marketing.
- **No gradients** as a rule. If gradients appear, they are subtle black-to-transparent "protection gradients" at the bottom of imagery for legibility. No purple/blue gradient fills anywhere.

### Typography

- **Reyhan** is the brand display typeface (uploaded, bundled in `fonts/`). Available weights: **Light (300)** for most display use, **Black (900)** for punctuated accent words. Reyhan carries the editorial voice — hero headlines, section titles, large numeric callouts.
- **Inter** is the UI/body face — product screens, tables, forms, anything under 24px. Reyhan is a display face and should not be used for body copy.
- **JetBrains Mono** is the developer/numeric face for code, tickers, API docs.
- **Tight tracking on display** (`-0.01em`) for editorial authority. Body sits at default metrics.
- **Mixed-weight display**: pairing Reyhan Light with Reyhan Black in the same line is an on-brand move for emphasis (e.g. *"Prime brokerage, **reimagined.**"*).
- **Medium (500)** is the workhorse heading weight — full Bold is avoided unless for emphasis inside body.
- See `colors_and_type.css` for full type scale.

### Backgrounds & imagery

- **Full-bleed editorial photography and 3D renders** dominate marketing. Imagery trends slightly cool, neutral-saturated, high-quality studio-grade. No warm "startup pastels."
- **3D brand universe** — Büro designed a modular, floating 3D world featuring the shield logo and Studio interface as centerpieces; imagery often features geometric forms on dark or white voids.
- **Pictograms** — bold, flat, slightly geometric illustrations inspired by airline safety visuals. One idea per pictogram (analytics, insights, reporting, real-time, secure, automation). Blue, black, white, occasional muted complement.
- **Video is common** on marketing — silent, looping, 3D-rendered clips of the product and brand universe.

### Borders & corners

- **Everything is rounded — no sharp corners anywhere.** Radius scales with element size: **4px** for the smallest controls (chips, tags), **6px** for inputs and table rows, **8px** for cards and panels, **10px** for large cards and modals, **16px** for oversized feature surfaces. **Buttons are fully pill-shaped (`999px`)**, as are tags, avatars and status chips.
- **Never use `border-radius: 0`.** 4px is the floor. Match the radius to the element's scale — small controls get 4–6px, containers get 8–10px, hero-scale blocks get 16px.
- **`radius-pill`** reserved for tags, avatars, status chips.
- **Borders are hairline (1px)** — never thick. Use `--cs-border` on white, `--cs-dark-border` on dark.

### Shadows

- Marketing uses **shadow sparingly** — the site is flat, editorial, grid-driven. Shadows mostly appear on hover for raise-states.
- Studio uses **a layered shadow system** to separate modal / popover / dropdown from the dense grid beneath. See `--cs-shadow-1` through `--cs-shadow-4`.
- Focus ring is a 3px Blueberry-blue halo at 25% alpha.

### Motion

- **Primary ease** is `cubic-bezier(0.22, 1, 0.36, 1)` — confident out-ease, no bounce.
- **Durations**: `120ms` micro (button press), `200ms` base (hover, dropdown), `360ms` slow (modal, page transition), `600ms` page (Büro's marquee transitions).
- **Hover states** — opacity `0.85` or a subtle lift on cards (`translateY(-2px)`); buttons darken by one shade (`--cs-blueberry-500` → `--cs-blueberry-600`).
- **Press states** — slight shrink (`scale(0.98)`), never a color flash.
- **Scroll-linked animation** is heavy on marketing (3D shield rotates, Studio emerges from thin air on scroll). In product, motion is functional and fast.
- **No bouncy springs, no particle effects, no decorative parallax dust.**

### Transparency & blur

- **Sticky nav uses backdrop blur** (\~20px) over a semi-transparent background on scroll.
- **Modals use a 40% black scrim**; no blur on the scrim.
- In Studio, popovers and command palettes use a subtle glass effect over the dark canvas.

### Layout

- Marketing: 12-col grid, `1440px` max, generous vertical whitespace, full-bleed hero sections.
- Studio: fixed sidebar + top utility bar + dense widget canvas. Widget-based composable dashboards (per their 2026 roadmap).
- **Fixed elements** in product: sidebar (left), top bar with ticker strip, bottom status bar with market-hours indicator.

### Cards

- **Marketing cards**: white background, rounded corners (8–10px), 1px border or no border, hover → subtle lift + border darkens.
- **Studio cards (widgets)**: dark surface `#18181B`, 1px `#2A2A2F` border, 8–10px radius, no shadow inside the dense grid.
- No "colored left-accent-stripe" cards. No emoji cards. No rounded-blob cards.

### Iconography (summary — see below)

Line icons, 1.5px stroke, rounded joins, 24×24 default. Built from a Lucide-class system. Shield mark is an important supporting icon.

---

## Iconography

Clear Street's product surfaces use a **line-icon system** — 24×24 default, 1.5px stroke, rounded line caps, subtle geometric construction. This matches the aesthetic seen in Studio screenshots (Trading / Shocks / Risk & margin / Dashboard nav glyphs).

**Our approach in this system:**

- We reference **Lucide** (CDN) as the substitute icon set — same stroke weight and geometric feel. Flag this as a substitution — replace with Clear Street's production icon font once available.
- **The Shield mark** is a brand-level icon and lives in `assets/logo/`. It should appear as the favicon, app icon, and loading state.
- **Pictograms** (for marketing) are a separate system — larger (\~80–120px), bolder, flat with 2–3 color fills, airline-safety-inspired. These are **not** icons; they're illustrations.
- **SVG-first** — no icon fonts in marketing code; SVGs imported as React components or `<img>` tags in Studio.
- **No emoji as icons**, ever.
- **No Unicode glyphs as icons** (no ★, ☆, ✓ etc. — use actual SVGs).
- **Duotone or filled icons** only appear when an icon needs emphasis (e.g., active nav state).

**Lucide usage from CDN:**

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<i data-lucide="trending-up"></i>
<script>lucide.createIcons();</script>
```

Common icon keys used across Studio: `trending-up`, `trending-down`, `bar-chart-3`, `line-chart`, `shield-check`, `lock`, `settings-2`, `layers`, `bell`, `search`, `chevron-down`, `arrow-right`, `play`, `pause`, `circle`, `alert-triangle`.

---

## Open Questions / Caveats

- **Fonts.** Reyhan (Light + Black) is bundled in `fonts/` as the display face. Inter (Google Fonts) is the UI body face.
- **Logo.** Official horizontal lockup (`clearstreet-lockup.svg`) and its mark-only derivative (`clearstreet-mark.svg`) are in `assets/logo/`. Both are `currentColor` — tint via CSS `color` on the `<svg>` or by inverting an `<img>` (`filter: brightness(0) invert(1)` for white).
- **Icon set.** Using **Lucide** as a stand-in. **Please share the production icon font / sprite** from Studio.
- **CDN imagery.** Many marketing visuals live on Sanity CDN (`cdn.sanity.io/images/40fnhjbe/...`); they are referenced directly in preview cards rather than downloaded. That works online; for offline bundles, please share the original files.
- **Studio internals.** Product components here are modelled from the public studio.clearstreet.io screenshots. We'd love **a codebase import or Figma link** to get pixel-perfect state, density, and dark-mode tokens.

---
