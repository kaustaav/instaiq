-- What the brand wants from a campaign: how many influencers (required) and, optionally, how many reels, stories
-- and posts in total. Targets only: shown against progress, never block anything.

ALTER TABLE campaign
    ADD COLUMN target_influencers integer,
    ADD COLUMN target_reels       integer CHECK (target_reels >= 0),
    ADD COLUMN target_stories     integer CHECK (target_stories >= 0),
    ADD COLUMN target_posts       integer CHECK (target_posts >= 0);

-- Campaigns created before this column existed: assume the members they have (at least 1).
UPDATE campaign c
SET target_influencers = GREATEST(1, (SELECT count(*) FROM campaign_member m WHERE m.campaign_id = c.id));

ALTER TABLE campaign
    ALTER COLUMN target_influencers SET NOT NULL,
    ADD CONSTRAINT campaign_target_influencers_ck CHECK (target_influencers > 0);
