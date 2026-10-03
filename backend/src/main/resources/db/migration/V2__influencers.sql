-- V2: influencers and their rate-card history. See docs/DATA_MODEL.md.
-- Enum-like columns use text + CHECK (not Postgres ENUM types) so adding a value is a one-line migration.

-- array_to_string() is only STABLE, and generated columns require IMMUTABLE functions.
-- Joining text with spaces is genuinely immutable, so this thin wrapper is safe.
CREATE FUNCTION join_words(text[]) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT coalesce(array_to_string($1, ' '), '') $$;

CREATE TABLE influencer (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    handle              citext       NOT NULL,                 -- lowercase, no "@"; citext = case-insensitive
    name                text         NOT NULL,
    bio                 text,
    email               text,
    phone               text,
    discovery_source    text         NOT NULL DEFAULT 'OTHER'
                        CHECK (discovery_source IN ('SEARCH', 'REFERRAL', 'INBOUND', 'OTHER')),

    status              text         NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'ON_HOLD', 'BANNED', 'ARCHIVED')),
    status_reason       text,
    status_changed_at   timestamptz,
    status_changed_by   text,

    -- arrays instead of join tables; values are validated against geo_city / taxonomy by the app
    cities              text[]       NOT NULL DEFAULT '{}',
    states              text[]       NOT NULL DEFAULT '{}',    -- states of the cities + state-only entries
    categories          text[]       NOT NULL,
    languages           text[]       NOT NULL DEFAULT '{}',
    hashtags            text[]       NOT NULL DEFAULT '{}',    -- lowercase, no "#"

    -- current metrics only (no history), with who/when/source
    followers           integer      NOT NULL CHECK (followers > 0),
    engagement_rate     numeric(5,2) CHECK (engagement_rate >= 0),
    avg_likes           integer      CHECK (avg_likes >= 0),
    avg_comments        integer      CHECK (avg_comments >= 0),
    metrics_updated_at  timestamptz  NOT NULL DEFAULT now(),
    metrics_updated_by  text         NOT NULL,
    metrics_source      text         NOT NULL DEFAULT 'MANUAL' CHECK (metrics_source IN ('MANUAL', 'SYSTEM')),

    recent_captions     text[]       NOT NULL DEFAULT '{}',
    captions_updated_at timestamptz,
    captions_updated_by text,
    captions_source     text         CHECK (captions_source IN ('MANUAL', 'SYSTEM')),

    notes               text,
    notes_updated_at    timestamptz,
    notes_updated_by    text,

    -- full-text search, maintained by Postgres on every write. Weights: A name/handle, B hashtags, C bio, D captions.
    -- 'simple' = no stemming (names, tags); 'english' = stemming (handcrafted -> handcraft) for prose.
    search_vector       tsvector GENERATED ALWAYS AS (
                            setweight(to_tsvector('simple',  coalesce(name, '') || ' ' || coalesce(handle::text, '')), 'A')
                         || setweight(to_tsvector('simple',  join_words(hashtags)), 'B')
                         || setweight(to_tsvector('english', coalesce(bio, '')), 'C')
                         || setweight(to_tsvector('english', join_words(recent_captions)), 'D')
                        ) STORED,

    created_at          timestamptz  NOT NULL DEFAULT now(),
    created_by          text         NOT NULL,
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    updated_by          text         NOT NULL,
    version             integer      NOT NULL DEFAULT 0,        -- optimistic locking (JPA @Version)

    CONSTRAINT influencer_handle_uq      UNIQUE (handle),
    CONSTRAINT influencer_location_ck    CHECK (cardinality(cities) + cardinality(states) >= 1),
    CONSTRAINT influencer_categories_ck  CHECK (cardinality(categories) >= 1),
    CONSTRAINT influencer_status_reason_ck CHECK (status = 'ACTIVE' OR status_reason IS NOT NULL)
);

-- Filters: "has any of these" on arrays (&&) uses GIN indexes
CREATE INDEX influencer_cities_gin     ON influencer USING gin (cities);
CREATE INDEX influencer_states_gin     ON influencer USING gin (states);
CREATE INDEX influencer_categories_gin ON influencer USING gin (categories);
CREATE INDEX influencer_languages_gin  ON influencer USING gin (languages);
CREATE INDEX influencer_hashtags_gin   ON influencer USING gin (hashtags);
-- Free-text search
CREATE INDEX influencer_search_gin     ON influencer USING gin (search_vector);
-- Typo-tolerant name / handle lookup (trigram similarity)
CREATE INDEX influencer_name_trgm      ON influencer USING gin (name gin_trgm_ops);
CREATE INDEX influencer_handle_trgm    ON influencer USING gin ((handle::text) gin_trgm_ops);
-- Range filters and sorting
CREATE INDEX influencer_followers_idx  ON influencer (followers);
CREATE INDEX influencer_engagement_idx ON influencer (engagement_rate);
CREATE INDEX influencer_metrics_at_idx ON influencer (metrics_updated_at);
CREATE INDEX influencer_status_idx     ON influencer (status);

-- Rate cards are history: a price change inserts a row, nothing is overwritten. Current = latest effective_from.
CREATE TABLE influencer_rate_card (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    influencer_id   bigint      NOT NULL REFERENCES influencer (id),
    story_inr       integer     CHECK (story_inr >= 0),          -- NULL = not shared
    reel_inr        integer     CHECK (reel_inr >= 0),
    post_inr        integer     CHECK (post_inr >= 0),
    effective_from  timestamptz NOT NULL DEFAULT now(),
    source          text        NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'SYSTEM')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      text        NOT NULL
);
CREATE INDEX influencer_rate_card_current_idx ON influencer_rate_card (influencer_id, effective_from DESC);
