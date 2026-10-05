package com.influenceiq.crm.campaign.api;

import java.util.List;

/** Body of POST /api/campaigns/{id}/members. */
public record AddMembersRequest(List<Long> influencerIds) {
}
