package com.influenceiq.crm.influencer;

/** No hard delete: influencers are archived or banned instead. Anything but ACTIVE needs a reason. */
public enum InfluencerStatus {
    ACTIVE,
    /** Temporarily unavailable; can still be added to campaigns, with a warning. */
    ON_HOLD,
    /** Do not work with; hidden from search by default, can't be added to campaigns. */
    BANNED,
    /** No longer relevant; hidden from search by default. */
    ARCHIVED
}
