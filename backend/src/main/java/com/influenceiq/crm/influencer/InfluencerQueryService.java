package com.influenceiq.crm.influencer;

import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.influencer.api.InfluencerResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads for the profile page. Writes go through the Ingestion Service. */
@Service
@RequiredArgsConstructor
public class InfluencerQueryService {

    private final InfluencerRepository influencers;
    private final InfluencerRateCardRepository rateCards;

    /** readOnly: lets Hibernate skip change-tracking (faster) and documents intent. */
    @Transactional(readOnly = true)
    public InfluencerResponse get(long id) {
        Influencer influencer = influencers.findById(id).orElseThrow(() -> new NotFoundException("Influencer", id));
        return InfluencerResponse.from(influencer, rateCards.findByInfluencerIdOrderByEffectiveFromDesc(id));
    }
}
