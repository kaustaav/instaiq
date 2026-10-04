package com.influenceiq.crm.influencer.api;

import com.influenceiq.crm.influencer.InfluencerStatus;

/** Body of PUT /api/influencers/{id}/status. A reason is required for anything but ACTIVE. */
public record StatusRequest(InfluencerStatus status, String reason) {
}
