package com.influenceiq.crm.ingestion;

import com.influenceiq.crm.influencer.DiscoverySource;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Raw influencer data from any source (the add form, an Excel row, the demo file, a future scraper).
 * Nothing here is trusted yet; InfluencerIngestionService validates and normalizes it.
 *
 * @param stateOnly         states for which the city isn't known (the cities' own states are derived)
 * @param metricsObservedAt when the numbers were true; null = now
 * @param ratesEffectiveFrom when the prices took effect; null = now
 */
public record InfluencerInput(
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
        int followers,
        BigDecimal engagementRate,
        Integer avgLikes,
        Integer avgComments,
        Integer storyInr,
        Integer reelInr,
        Integer postInr,
        String notes,
        Instant metricsObservedAt,
        Instant ratesEffectiveFrom) {
}
