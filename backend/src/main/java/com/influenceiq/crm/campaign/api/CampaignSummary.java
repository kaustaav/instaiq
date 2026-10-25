package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.CampaignStatus;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One row of the campaign list. Deliberately light: members, progress, budget, drafts and payments are on the
 * campaign's own page (GET /api/campaigns/{id}). The list is one query on the campaign table alone: nothing per
 * campaign is counted or loaded, so its cost doesn't grow with members or content.
 */
public record CampaignSummary(
        long id,
        String name,
        String brand,
        CampaignStatus status,
        LocalDate startDate,
        LocalDate endDate,
        Instant createdAt) {
}
