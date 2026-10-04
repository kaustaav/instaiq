package com.influenceiq.crm.influencer.api;

import com.influenceiq.crm.influencer.DiscoverySource;
import com.influenceiq.crm.ingestion.InfluencerInput;
import java.math.BigDecimal;
import java.util.List;

/**
 * Body of POST /api/influencers and PUT /api/influencers/{id}: what the add/edit form sends.
 * Validation happens in the Ingestion Service (one place for every source), not here.
 *
 * @param version for PUT only: the version the client loaded (optimistic locking); ignored on create
 */
public record InfluencerRequest(
        String handle,
        String name,
        String bio,
        String email,
        String phone,
        DiscoverySource discoverySource,
        List<String> cities,
        List<String> stateOnly,
        List<String> categories,
        List<String> languages,
        List<String> hashtags,
        Integer followers,
        BigDecimal engagementRate,
        Integer avgLikes,
        Integer avgComments,
        Integer storyInr,
        Integer reelInr,
        Integer postInr,
        Integer version) {

    InfluencerInput toInput() {
        return new InfluencerInput(handle, name, bio, email, phone, discoverySource, cities, stateOnly, categories,
                languages, hashtags, followers == null ? 0 : followers, engagementRate, avgLikes, avgComments,
                storyInr, reelInr, postInr, null, null, null); // notes have their own endpoint; dates = now
    }
}
