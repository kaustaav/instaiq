package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.CampaignService.Terms;
import com.influenceiq.crm.campaign.Compensation;

/** Body of POST /api/campaigns/{id}/members/{influencerId}/terms. Counts default to 0. */
public record TermsRequest(Compensation compensation, Integer feeInr, Integer reels, Integer stories, Integer posts) {

    Terms toTerms() {
        return new Terms(compensation, feeInr, n(reels), n(stories), n(posts));
    }

    private static int n(Integer v) {
        return v == null ? 0 : v;
    }
}
