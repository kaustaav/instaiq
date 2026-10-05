-- Content per member: one row per reel / story / post, created when terms are agreed, and the draft review loop
-- (one row per round, append-only; a review fills in its decision once). docs/DATA_MODEL.md.

CREATE TABLE campaign_deliverable (
    id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id  bigint      NOT NULL REFERENCES campaign_member (id),
    type       text        NOT NULL CHECK (type IN ('REEL', 'STORY', 'POST')),
    seq        integer     NOT NULL CHECK (seq > 0),                -- "Reel 2" = the member's 2nd reel
    status     text        NOT NULL DEFAULT 'AWAITING_DRAFT'
               CHECK (status IN ('AWAITING_DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'POSTED')),
    live_url   text,
    posted_at  date,

    CONSTRAINT campaign_deliverable_seq_uq    UNIQUE (member_id, type, seq),
    CONSTRAINT campaign_deliverable_posted_ck CHECK ((status = 'POSTED') = (live_url IS NOT NULL AND posted_at IS NOT NULL))
);

CREATE TABLE deliverable_revision (
    id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deliverable_id bigint      NOT NULL REFERENCES campaign_deliverable (id),
    round          integer     NOT NULL CHECK (round > 0),
    draft_url      text        NOT NULL,
    submitted_at   timestamptz NOT NULL,
    submitted_by   text        NOT NULL,
    decision       text        CHECK (decision IN ('APPROVED', 'CHANGES_REQUESTED')),
    feedback       text,
    reviewed_at    timestamptz,
    reviewed_by    text,

    CONSTRAINT deliverable_revision_round_uq    UNIQUE (deliverable_id, round),
    CONSTRAINT deliverable_revision_reviewed_ck CHECK ((decision IS NULL) = (reviewed_at IS NULL)),
    CONSTRAINT deliverable_revision_feedback_ck CHECK (decision IS DISTINCT FROM 'CHANGES_REQUESTED' OR feedback IS NOT NULL)
);
