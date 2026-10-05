-- Payments to a campaign member: append-only, one row per payment (advance, final...), each with its own proof.
-- Amount paid = sum of rows; payment status lives on campaign_member. docs/DATA_MODEL.md.

CREATE TABLE campaign_payment (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id   bigint      NOT NULL REFERENCES campaign_member (id),
    amount_inr  integer     NOT NULL CHECK (amount_inr > 0),
    paid_at     date        NOT NULL,
    receipt_url text        NOT NULL,     -- proof of payment, e.g. a Google Drive link to the receipt
    recorded_at timestamptz NOT NULL DEFAULT now(),
    recorded_by text        NOT NULL
);

CREATE INDEX campaign_payment_member_idx ON campaign_payment (member_id);
