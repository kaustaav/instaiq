package com.influenceiq.crm.influencer.search;

import com.influenceiq.crm.influencer.InfluencerStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** One search result: what a card or table row needs, nothing more (the full profile is a separate call). */
public record InfluencerSummary(
        long id,
        String handle,
        String name,
        List<String> cities,
        List<String> states,
        List<String> categories,
        List<String> languages,
        List<String> hashtags,
        int followers,
        BigDecimal engagementRate,
        Integer avgLikes,
        Instant metricsUpdatedAt,
        InfluencerStatus status,
        Integer reelInr) {
}
