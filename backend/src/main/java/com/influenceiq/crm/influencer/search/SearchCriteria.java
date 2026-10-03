package com.influenceiq.crm.influencer.search;

import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.InfluencerStatus;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * What to search for. Same semantics as the UI (frontend/src/lib/search.ts):
 * values within one filter are OR'ed (any of these categories), different filters are AND'ed.
 *
 * @param page 1-based, like the UI's ?page=
 */
public record SearchCriteria(
        String q,
        List<LocationFilter> locations,
        List<String> categories,
        List<String> languages,
        Integer followersMin,
        Integer followersMax,
        BigDecimal minEngagementRate,
        Set<InfluencerStatus> statuses,
        int page,
        int size) {

    public static final int MAX_PAGE_SIZE = 100;
    /** Banned and archived influencers are hidden unless asked for. */
    public static final Set<InfluencerStatus> DEFAULT_STATUSES = Set.of(InfluencerStatus.ACTIVE, InfluencerStatus.ON_HOLD);

    public SearchCriteria {
        q = q == null || q.isBlank() ? null : q.trim();
        locations = locations == null ? List.of() : List.copyOf(locations);
        categories = categories == null ? List.of() : List.copyOf(categories);
        languages = languages == null ? List.of() : List.copyOf(languages);
        statuses = statuses == null || statuses.isEmpty() ? DEFAULT_STATUSES : Set.copyOf(statuses);
        if (page < 1) throw new ValidationException("page must be 1 or more");
        if (size < 1 || size > MAX_PAGE_SIZE) throw new ValidationException("size must be between 1 and " + MAX_PAGE_SIZE);
        if (followersMin != null && followersMax != null && followersMin > followersMax) {
            throw new ValidationException("fmin can't be more than fmax");
        }
    }

    /** loc=city:Chandigarh or loc=state:Punjab (the UI's URL format). */
    public record LocationFilter(Type type, String name) {

        public enum Type { CITY, STATE }

        public static LocationFilter parse(String raw) {
            String[] parts = raw == null ? new String[0] : raw.split(":", 2); // "city:Navi Mumbai" -> [city, Navi Mumbai]
            if (parts.length != 2 || parts[1].isBlank() || !(parts[0].equals("city") || parts[0].equals("state"))) {
                throw new ValidationException("loc must look like city:Name or state:Name, got: " + raw);
            }
            return new LocationFilter(parts[0].equals("city") ? Type.CITY : Type.STATE, parts[1].trim());
        }
    }
}
