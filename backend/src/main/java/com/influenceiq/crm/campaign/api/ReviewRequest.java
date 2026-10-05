package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.ReviewDecision;

/** Body of POST .../deliverables/{deliverableId}/review. Feedback is required when asking for changes. */
public record ReviewRequest(ReviewDecision decision, String feedback) {
}
