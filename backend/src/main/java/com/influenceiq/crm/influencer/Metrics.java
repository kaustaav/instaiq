package com.influenceiq.crm.influencer;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * An influencer's engagement numbers, as one value. Validated on creation.
 * <p>
 * The engagement rate is normalized to 2 decimals (the column is numeric(5,2)), because BigDecimal.equals
 * compares scale too: 6.2 and 6.20 would otherwise count as "different" and break the freshness rule.
 */
public record Metrics(int followers, BigDecimal engagementRate, Integer avgLikes, Integer avgComments) {

    public Metrics {
        if (followers <= 0) {
            throw new IllegalArgumentException("Followers must be more than 0");
        }
        if (engagementRate != null) {
            if (engagementRate.signum() < 0) {
                throw new IllegalArgumentException("Engagement rate can't be negative");
            }
            engagementRate = engagementRate.setScale(2, RoundingMode.HALF_UP);
        }
        if (avgLikes != null && avgLikes < 0 || avgComments != null && avgComments < 0) {
            throw new IllegalArgumentException("Average likes and comments can't be negative");
        }
    }

    public static Metrics ofFollowers(int followers) {
        return new Metrics(followers, null, null, null);
    }
}
