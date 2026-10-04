package com.influenceiq.crm.influencer.search;

import java.util.List;

/**
 * Influencer search. An interface so the implementation can change (Postgres now, OpenSearch maybe in Phase 2)
 * without touching controllers: open for extension, closed for modification.
 */
public interface InfluencerSearchService {

    SearchPage<InfluencerSummary> search(SearchCriteria criteria);

    /** Max ids returned by {@link #searchIds}: a guard against accidentally selecting the whole database. */
    int MAX_IDS = 5000;

    /** Ids of every match (ignoring page/size), for bulk actions like "Add all to campaign". */
    List<Long> searchIds(SearchCriteria criteria);
}
