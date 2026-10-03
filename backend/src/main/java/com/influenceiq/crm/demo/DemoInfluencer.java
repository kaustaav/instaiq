package com.influenceiq.crm.demo;

import com.influenceiq.crm.influencer.DiscoverySource;
import com.influenceiq.crm.ingestion.InfluencerInput;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * One row of demo/influencers.json. Ages are relative ("metrics 12 days old") so freshness stays realistic
 * whenever the data is loaded.
 */
record DemoInfluencer(
        String handle, String name, String bio, String email, String phone,
        List<String> cities, List<String> stateOnly, List<String> categories, List<String> languages,
        List<String> hashtags, int followers, BigDecimal engagementRate, Integer avgLikes, Integer avgComments,
        Integer storyInr, Integer reelInr, Integer postInr, String notes, int metricsAgeDays, int ratesAgeDays) {

    InfluencerInput toInput(Instant now) {
        return new InfluencerInput(handle, name, bio, email, phone, DiscoverySource.SEARCH, cities, stateOnly,
                categories, languages, hashtags, followers, engagementRate, avgLikes, avgComments,
                storyInr, reelInr, postInr, notes,
                now.minus(metricsAgeDays, ChronoUnit.DAYS), now.minus(ratesAgeDays, ChronoUnit.DAYS));
    }
}
