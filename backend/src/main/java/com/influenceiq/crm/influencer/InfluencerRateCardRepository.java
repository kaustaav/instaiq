package com.influenceiq.crm.influencer;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InfluencerRateCardRepository extends JpaRepository<InfluencerRateCard, Long> {

    /** Current rate card = newest effectiveFrom. Uses the (influencer_id, effective_from DESC) index. */
    Optional<InfluencerRateCard> findFirstByInfluencerIdOrderByEffectiveFromDesc(Long influencerId);

    /** Full history, newest first, for the profile's "rate history". */
    List<InfluencerRateCard> findByInfluencerIdOrderByEffectiveFromDesc(Long influencerId);
}
