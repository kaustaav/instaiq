# InfluenceIQ — Influencer CRM: project rules

Working file: `Influencer CRM v2.dc.html` (the original upload is `Influencer CRM.dc.html`; leave it untouched). The handoff spec is in `design_handoff_influencer_crm/README.md`. Keep both in sync when rules change.

## Product decisions (don't regress)
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

## Implementation notes for the prototype
- Icons are CSS-mask spans pointing at `lucide-static` SVGs. **Don't use `lucide.createIcons()`**: it swaps React-owned nodes and crashes when things unmount.
- Tables sit in `overflow-x:auto` wrappers so action columns stay reachable at narrow widths.
- Design tokens come from `_ds/clear-street-design-system-…/colors_and_type.css` (`--cs-*` variables).
