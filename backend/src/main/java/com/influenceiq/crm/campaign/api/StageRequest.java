package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.MemberStage;

/** Body of PUT /api/campaigns/{id}/members/{influencerId}/stage, e.g. {"stage": "CONTACTED"}. */
public record StageRequest(MemberStage stage, String reason) {
}
