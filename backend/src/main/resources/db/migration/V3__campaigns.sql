-- Campaigns and their members (docs/DATA_MODEL.md). Deliverables, draft revisions and payments come in later migrations.
-- Same conventions as V2: text + CHECK instead of ENUM types, audit columns, version for optimistic locking.

CREATE TABLE campaign (
    id                bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              text         NOT NULL CHECK (btrim(name) <> ''),
    brand             text         NOT NULL CHECK (btrim(brand) <> ''),   -- free text for now
    brief             text,
    start_date        date,
    end_date          date,
    budget_inr        integer      CHECK (budget_inr >= 0),               -- NULL = no budget set

    status            text         NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED')),
    archived_from     text         CHECK (archived_from IN ('COMPLETED', 'CANCELLED')), -- where "unarchive" returns to
    status_reason     text,                                               -- latest reason only
    status_changed_at timestamptz  NOT NULL DEFAULT now(),
    status_changed_by text         NOT NULL,

    created_at        timestamptz  NOT NULL DEFAULT now(),
    created_by        text         NOT NULL,
    updated_at        timestamptz  NOT NULL DEFAULT now(),
    updated_by        text         NOT NULL,
    version           integer      NOT NULL DEFAULT 0,

    CONSTRAINT campaign_dates_ck         CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
    CONSTRAINT campaign_archived_from_ck CHECK ((status = 'ARCHIVED') = (archived_from IS NOT NULL))
);

CREATE INDEX campaign_status_idx ON campaign (status);

-- One row per influencer in a campaign. Own id (simple for JPA and for the deliverable/payment tables that will
-- point here); the "one influencer once per campaign" rule is the unique constraint.
CREATE TABLE campaign_member (
    id                       bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    campaign_id              bigint      NOT NULL REFERENCES campaign (id),
    influencer_id            bigint      NOT NULL REFERENCES influencer (id),

    stage                    text        NOT NULL DEFAULT 'SHORTLISTED'
                             CHECK (stage IN ('SHORTLISTED', 'CONTACTED', 'NEGOTIATING', 'AGREED', 'DECLINED')),
    stage_reason             text,
    stage_updated_at         timestamptz NOT NULL DEFAULT now(),
    stage_updated_by         text        NOT NULL,

    compensation_type        text        NOT NULL DEFAULT 'CASH'
                             CHECK (compensation_type IN ('CASH', 'BARTER', 'CASH_AND_PRODUCT')),
    agreed_fee_inr           integer     CHECK (agreed_fee_inr > 0),
    payment_status           text        NOT NULL DEFAULT 'NOT_DUE'
                             CHECK (payment_status IN ('NOT_DUE', 'DUE', 'PARTIALLY_PAID', 'PAID', 'WAIVED')),
    payment_write_off_reason text,
    notes                    text,

    added_at                 timestamptz NOT NULL DEFAULT now(),
    added_by                 text        NOT NULL,

    CONSTRAINT campaign_member_uq UNIQUE (campaign_id, influencer_id)
);

-- "Which campaigns is this influencer in?" (profile campaign history). The unique constraint already covers
-- lookups by campaign_id, since it's the leading column.
CREATE INDEX campaign_member_influencer_idx ON campaign_member (influencer_id);
