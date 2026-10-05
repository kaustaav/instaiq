package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.Campaign;
import com.influenceiq.crm.campaign.CampaignMember;
import com.influenceiq.crm.campaign.CampaignRepository;
import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRepository;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read side: builds API responses. readOnly transaction = lazy members can load, and Hibernate skips dirty checks.
 * Influencers are loaded in one query for all members (not one per member).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CampaignQueryService {

    private final CampaignRepository campaigns;
    private final InfluencerRepository influencers;

    /** All campaigns, newest first. Fine at agency scale (hundreds); add paging/filters here if it grows. */
    public List<CampaignSummary> list() {
        return campaigns.findAllByOrderByIdDesc().stream().map(CampaignSummary::from).toList();
    }

    public CampaignResponse get(long id) {
        Campaign c = campaigns.findById(id).orElseThrow(() -> new NotFoundException("Campaign", id));
        List<Long> ids = c.getMembers().stream().map(CampaignMember::getInfluencerId).toList();
        Map<Long, Influencer> byId = influencers.findAllById(ids).stream()
                .collect(Collectors.toMap(Influencer::getId, Function.identity()));
        return CampaignResponse.from(c, byId);
    }

    /** GET /api/influencers/{id}/campaigns */
    public List<InfluencerCampaign> forInfluencer(long influencerId) {
        if (!influencers.existsById(influencerId)) throw new NotFoundException("Influencer", influencerId);
        return campaigns.findAllWithInfluencer(influencerId).stream()
                .map(c -> InfluencerCampaign.from(c, c.member(influencerId).orElseThrow()))
                .toList();
    }
}
