package com.influenceiq.crm.influencer.api;

import com.influenceiq.crm.influencer.InfluencerStatus;
import com.influenceiq.crm.influencer.search.SearchCriteria;
import com.influenceiq.crm.influencer.search.SearchCriteria.LocationFilter;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Query parameters of GET /api/influencers. Spring fills this record from the URL by matching names, e.g.
 * <pre>/api/influencers?q=bridal&loc=city:Chandigarh&loc=state:Punjab&cat=Jewellery&fmin=2000&er=5&page=2</pre>
 * The names are the UI's URL contract (frontend/src/lib/search.ts), so a UI link maps 1:1 to an API call.
 * Repeated parameters (loc, cat, lang, status) become lists. fresh=fresh|ageing|stale filters by metrics age.
 */
public record SearchRequest(
        String q,
        List<String> loc,
        List<String> cat,
        List<String> lang,
        Integer fmin,
        Integer fmax,
        BigDecimal er,
        Set<InfluencerStatus> status,
        String fresh,
        Integer page,
        Integer size) {

    SearchCriteria toCriteria() {
        return new SearchCriteria(
                q,
                loc == null ? List.of() : loc.stream().map(LocationFilter::parse).toList(),
                cat, lang, fmin, fmax, er, status, SearchCriteria.Freshness.parse(fresh),
                page == null ? 1 : page,
                size == null ? SearchCriteria.MAX_PAGE_SIZE : size);
    }
}
