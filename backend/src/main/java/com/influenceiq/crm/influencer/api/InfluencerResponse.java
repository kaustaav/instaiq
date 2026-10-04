package com.influenceiq.crm.influencer.api;

import com.influenceiq.crm.common.Origin;
import com.influenceiq.crm.influencer.DiscoverySource;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRateCard;
import com.influenceiq.crm.influencer.InfluencerStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * The full profile, as the API returns it. A record (DTO), not the entity: the API shape stays stable when the
 * table changes, and internals like the JPA version or lazy relations never leak into JSON.
 */
public record InfluencerResponse(
        Long id,
        String handle,
        String profileUrl,
        String name,
        String bio,
        String email,
        String phone,
        DiscoverySource discoverySource,
        InfluencerStatus status,
        String statusReason,
        List<String> cities,
        List<String> states,
        List<String> categories,
        List<String> languages,
        List<String> hashtags,
        MetricsView metrics,
        RatesView currentRates,
        List<RatesView> rateHistory,
        List<String> recentCaptions,
        String notes,
        Instant createdAt,
        Instant updatedAt,
        /** Send back on edit (optimistic locking): if it no longer matches, someone else saved first. */
        int version) {

    public record MetricsView(int followers, BigDecimal engagementRate, Integer avgLikes, Integer avgComments,
                              Instant updatedAt, String updatedBy, Origin source) {}

    public record RatesView(Integer storyInr, Integer reelInr, Integer postInr, Instant effectiveFrom, Origin source) {

        static RatesView from(InfluencerRateCard r) {
            return new RatesView(r.getStoryInr(), r.getReelInr(), r.getPostInr(), r.getEffectiveFrom(), r.getSource());
        }
    }

    /** @param rateHistory newest first; may be empty (prices never shared) */
    public static InfluencerResponse from(Influencer i, List<InfluencerRateCard> rateHistory) {
        List<RatesView> history = rateHistory.stream().map(RatesView::from).toList();
        return new InfluencerResponse(
                i.getId(), i.getHandle().value(), i.getHandle().profileUrl(), i.getName(), i.getBio(), i.getEmail(),
                i.getPhone(), i.getDiscoverySource(), i.getStatus(), i.getStatusReason(),
                i.getCities(), i.getStates(), i.getCategories(), i.getLanguages(), i.getHashtags(),
                new MetricsView(i.getFollowers(), i.getEngagementRate(), i.getAvgLikes(), i.getAvgComments(),
                        i.getMetricsUpdatedAt(), i.getMetricsUpdatedBy(), i.getMetricsSource()),
                history.isEmpty() ? null : history.getFirst(), history,
                i.getRecentCaptions(), i.getNotes(), i.getCreatedAt(), i.getUpdatedAt(), i.getVersion());
    }
}
