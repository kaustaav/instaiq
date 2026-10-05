package com.influenceiq.crm.campaign.api;

/** Body of PUT /api/campaigns/{id}/members/{influencerId}/fee: the new fee and why it changed. */
public record FeeRequest(Integer feeInr, String reason) {
}
