package com.influenceiq.crm.influencer;

import com.influenceiq.crm.common.CreatedAudit;
import com.influenceiq.crm.common.Origin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One version of an influencer's prices (append-only history). A price change inserts a new row;
 * the current rate card is the one with the latest effectiveFrom. Prices are whole rupees; null = not shared.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED) // JPA needs it; application code uses the public constructor
@Entity
@Table(name = "influencer_rate_card")
public class InfluencerRateCard extends CreatedAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Many rate cards belong to one influencer. LAZY: loading a rate card doesn't also load the influencer
    // until you actually call getInfluencer(), which avoids unnecessary queries.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "influencer_id", nullable = false)
    private Influencer influencer;

    @Column(name = "story_inr")
    private Integer storyInr;
    @Column(name = "reel_inr")
    private Integer reelInr;
    @Column(name = "post_inr")
    private Integer postInr;

    @Column(name = "effective_from", nullable = false)
    private Instant effectiveFrom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Origin source;

    /** @param effectiveFrom when these prices took effect (null = now) */
    public InfluencerRateCard(Influencer influencer, Integer storyInr, Integer reelInr, Integer postInr, Origin source,
                              Instant effectiveFrom) {
        if (isNegative(storyInr) || isNegative(reelInr) || isNegative(postInr)) {
            throw new IllegalArgumentException("Prices can't be negative");
        }
        this.influencer = influencer;
        this.storyInr = storyInr;
        this.reelInr = reelInr;
        this.postInr = postInr;
        this.effectiveFrom = effectiveFrom == null ? Instant.now() : effectiveFrom;
        this.source = source;
    }

    private static boolean isNegative(Integer v) {
        return v != null && v < 0;
    }

}
