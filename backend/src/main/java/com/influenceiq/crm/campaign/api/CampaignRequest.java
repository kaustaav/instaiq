package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.CampaignDetails;
import java.time.LocalDate;

/**
 * Body of POST /api/campaigns and PUT /api/campaigns/{id}. Dates are "2026-10-05".
 *
 * @param version PUT only: the version the client loaded (optimistic locking)
 */
public record CampaignRequest(String name, String brand, String brief, LocalDate startDate, LocalDate endDate,
                              Integer budgetInr, Integer targetInfluencers, Integer targetReels,
                              Integer targetStories, Integer targetPosts, Integer version) {

    CampaignDetails toDetails() {
        return new CampaignDetails(name, brand, brief, startDate, endDate, budgetInr, targetInfluencers, targetReels,
                targetStories, targetPosts);
    }
}
