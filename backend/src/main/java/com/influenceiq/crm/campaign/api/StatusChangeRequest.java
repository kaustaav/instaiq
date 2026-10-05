package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.CampaignAction;

/** Body of POST /api/campaigns/{id}/status, e.g. {"action": "CANCEL", "reason": "Brand paused spend"}. */
public record StatusChangeRequest(CampaignAction action, String reason) {
}
