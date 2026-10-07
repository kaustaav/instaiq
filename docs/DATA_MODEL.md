# Data model (Phase 1)

PostgreSQL. Decided 2026-10-02. History is kept only where it's needed (rate cards, draft reviews, payments); everything else stores
the current value plus who changed it and when. Every table has `created_at/by`, `updated_at/by`; editable aggregates
also have `version` (optimistic locking). `*_by` is the signed-in user's Google email (an `app_user` table may replace it later).

## Influencers

### `influencer`
| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `handle` | citext UNIQUE NOT NULL | lowercase, no `@`; a pasted instagram.com URL is reduced to the handle |
| `name` | text NOT NULL | |
| `bio`, `email`, `phone` | text | |
| `discovery_source` | enum `SEARCH` · `REFERRAL` · `INBOUND` · `OTHER` | how we found them |
| `status` | enum `ACTIVE` · `ON_HOLD` · `BANNED` · `ARCHIVED` | no hard delete |
| `status_reason`, `status_changed_at`, `status_changed_by` | | reason required when not `ACTIVE` |
| `cities`, `states` | text[] | `states` = states of the cities + state-only entries (kept in sync by the app) |
| `categories` | text[] (≥ 1) | values from `taxonomy` |
| `languages` | text[] | values from `taxonomy` |
| `hashtags` | text[] | lowercase, no `#` |
| `followers` | int NOT NULL > 0 | |
| `engagement_rate` | numeric(5,2) NULL | manual/dummy for now |
| `avg_likes`, `avg_comments` | int | |
| `metrics_updated_at`, `metrics_updated_by`, `metrics_source` | | source `MANUAL` · `SYSTEM`; updated only when a metric value changes |
| `recent_captions` | text[] | |
| `captions_updated_at`, `captions_updated_by`, `captions_source` | | |
| `notes`, `notes_updated_at`, `notes_updated_by` | | |
| `search_vector` | tsvector, generated | name, handle, bio, hashtags, captions |

Constraint: at least one city or state. Indexes: GIN on the arrays and `search_vector`; btree on `followers`,
`engagement_rate`, `metrics_updated_at`, `status`; trigram on `name`, `handle`.

| Status | Search | Can be added to a campaign |
|---|---|---|
| `ACTIVE` | shown | yes |
| `ON_HOLD` | shown, badge | yes, with a warning |
| `BANNED` | hidden by default (filterable) | no; if banned mid-campaign, flagged, not removed |
| `ARCHIVED` | hidden by default | no |

### `influencer_rate_card` (append-only; current = latest `effective_from`)
`id`, `influencer_id` FK, `story_inr`, `reel_inr`, `post_inr` (int, NULL = not shared), `effective_from`, `source`, `created_by`.

### Reference lists (dropdowns and validation; never joined in search)
- `geo_city (state, city UNIQUE)`: one city → one state; custom cities added here.
- `taxonomy (type CATEGORY|LANGUAGE, value, is_custom, created_by)`: UNIQUE `(type, lower(value))`.

Served by `GET /api/reference` (ETag), cached in backend memory and in the browser; refetched on tab focus and when a
filter panel or form opens.

## Campaigns

### `campaign`
| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `name`, `brand` | text NOT NULL | brand is free text for now |
| `brief` | text | |
| `start_date`, `end_date` | date | end ≥ start |
| `budget_inr` | int NULL | |
| `target_influencers` | int NOT NULL (> 0) | how many influencers the brand wants |
| `target_reels`, `target_stories`, `target_posts` | int NULL (≥ 0) | optional content totals for the whole campaign; targets only, never block |
| `status` | enum `DRAFT` · `ACTIVE` · `COMPLETED` · `CANCELLED` · `ARCHIVED` | |
| `archived_from` | `COMPLETED` · `CANCELLED` | set only while `ARCHIVED`; where "unarchive" returns to |
| `status_reason`, `status_changed_at`, `status_changed_by` | | latest reason only |

### `campaign_member` (own `id`; UNIQUE `campaign_id, influencer_id`: one influencer once per campaign)
| Column | Type | Notes |
|---|---|---|
| `stage` | enum `SHORTLISTED` · `CONTACTED` · `NEGOTIATING` · `AGREED` · `DECLINED` | `IN_PRODUCTION`, `LIVE`, `COMPLETED` are derived (below) |
| `stage_reason`, `stage_updated_at`, `stage_updated_by` | | latest reason only |
| `compensation_type` | enum `CASH` · `BARTER` · `CASH_AND_PRODUCT` | |
| `agreed_fee_inr` | int NULL | pre-filled from the current rate card |
| `payment_status` | enum `NOT_DUE` · `DUE` · `PARTIALLY_PAID` · `PAID` · `WAIVED` | amount paid = sum of `campaign_payment` |
| `payment_write_off_reason` | text | set when `DUE`/`PARTIALLY_PAID` → `WAIVED`; the rest is settled with product, so the deal becomes `BARTER` (nothing paid, no fee) or `CASH_AND_PRODUCT` (fee = amount paid) and the committed budget drops accordingly |
| `notes` | text | |

### `campaign_payment` (append-only: one row per payment)
`id`, `campaign_id`, `influencer_id`, `amount_inr` (> 0), `paid_at` (date), `receipt_url` (proof of payment, e.g. a Google
Drive link to the receipt or screenshot; required), `recorded_at`, `recorded_by`. Advances and final payments each keep
their own proof.

### `campaign_deliverable` (one row per reel / story / post; created when terms are agreed)
`id`, `campaign_id`, `influencer_id`, `type` (`REEL` · `STORY` · `POST`),
`status` (`AWAITING_DRAFT` · `IN_REVIEW` · `CHANGES_REQUESTED` · `APPROVED` · `POSTED`), `live_url`, `posted_at`.

### `deliverable_revision` (append-only: the review loop)
`id`, `deliverable_id`, `round`, `draft_url`, `submitted_at`, `submitted_by`, `decision` (`APPROVED` · `CHANGES_REQUESTED`),
`feedback`, `reviewed_at`, `reviewed_by`. Anyone can submit (staff now, influencers once a portal exists).

## State machines

Campaign
```
DRAFT ──activate──▶ ACTIVE ──complete──▶ COMPLETED
  │  [name, brand,     │   [every non-declined member COMPLETED]
  │   dates, ≥1 member]│
  └──cancel──▶ CANCELLED ◀──cancel── (ACTIVE) [no live-but-unpaid content]
★ reopen: COMPLETED → ACTIVE, CANCELLED → ACTIVE
archive: COMPLETED/CANCELLED → ARCHIVED; ★ unarchive → previous status
COMPLETED, CANCELLED, ARCHIVED are read-only.
```

Member (relationship)
```
SHORTLISTED → CONTACTED → NEGOTIATING → AGREED → IN_PRODUCTION → LIVE → COMPLETED
                                       [deliverables  (derived: any  (derived: all  [payment PAID,
                                        + fee, or      deliverable    deliverables   or WAIVED for
                                        barter]        not posted)    POSTED)        barter]
DECLINED from any stage before AGREED. ★ one step back allowed. ★ fee change after AGREED.
Members with posted content or payments can't be removed.
```

Deliverable (content), per deliverable
```
AWAITING_DRAFT ──submit──▶ IN_REVIEW ──approve──▶ APPROVED ──live link──▶ POSTED
                              │  ▲
               request changes│  │resubmit        (any number of rounds; each round = one deliverable_revision)
                              ▼  │
                       CHANGES_REQUESTED
```

Payment
```
NOT_DUE ──[AGREED]──▶ DUE ──▶ PARTIALLY_PAID ──▶ PAID     [each payment: date + receipt link; PAID when sum ≥ agreed fee]
   └──[BARTER]──▶ WAIVED      ★ DUE / PARTIALLY_PAID → WAIVED (write-off)
Advances (PARTIALLY_PAID) allowed before content is live.
```
★ = needs a reason (stored as the row's latest reason).

## Rules (enforced in the backend; DB CHECKs for single-row invariants; the UI greys out actions and says why)
- Budget: agreed fees of members at AGREED or later over `budget_inr` → warning, not a block.
- BANNED / ARCHIVED influencers can't be added; ON_HOLD shows a warning.
- Read-only campaigns accept no member, deliverable or payment changes.

## Parked corner cases
Limit on revision rounds · brand (client) approval of drafts · influencer drops out after AGREED · expired story links
(screenshot proof) · campaign stage-change log (decided: not now).
