package com.influenceiq.crm.campaign;

import com.influenceiq.crm.common.ValidationException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * The editable part of a campaign (what the create/edit form sends). Validated on construction, so a
 * CampaignDetails that exists is always valid; every problem is reported at once.
 *
 * @param budgetInr         null = no budget set
 * @param targetInfluencers how many influencers the brand wants (required, at least 1)
 * @param targetReels       optional totals for the whole campaign; null = not specified
 */
public record CampaignDetails(String name, String brand, String brief, LocalDate startDate, LocalDate endDate,
                              Integer budgetInr, Integer targetInfluencers, Integer targetReels,
                              Integer targetStories, Integer targetPosts) {

    public CampaignDetails {
        name = blankToNull(name);
        brand = blankToNull(brand);
        brief = blankToNull(brief);
        List<String> errors = new ArrayList<>();
        if (name == null) errors.add("Name is required");
        if (brand == null) errors.add("Brand is required");
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) errors.add("End date is before start date");
        if (budgetInr != null && budgetInr < 0) errors.add("Budget can't be negative");
        if (targetInfluencers == null || targetInfluencers < 1) errors.add("Number of influencers is required (at least 1)");
        if (targetReels != null && targetReels < 0) errors.add("Number of reels can't be negative");
        if (targetStories != null && targetStories < 0) errors.add("Number of stories can't be negative");
        if (targetPosts != null && targetPosts < 0) errors.add("Number of posts can't be negative");
        if (!errors.isEmpty()) throw new ValidationException(errors);
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
