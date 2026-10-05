package com.influenceiq.crm.campaign.api;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/influencers/{id}/campaigns. Lives in the campaign package: campaigns know about influencers, never
 * the other way round, so the influencer code doesn't depend on campaigns.
 */
@RestController
@RequiredArgsConstructor
public class InfluencerCampaignsController {

    private final CampaignQueryService queries;

    @GetMapping("/api/influencers/{id}/campaigns")
    public List<InfluencerCampaign> campaigns(@PathVariable long id) {
        return queries.forInfluencer(id);
    }
}
