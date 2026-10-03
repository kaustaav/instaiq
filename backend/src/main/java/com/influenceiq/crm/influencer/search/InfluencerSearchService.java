package com.influenceiq.crm.influencer.search;

/**
 * Influencer search. An interface so the implementation can change (Postgres now, OpenSearch maybe in Phase 2)
 * without touching controllers: open for extension, closed for modification.
 */
public interface InfluencerSearchService {

    SearchPage<InfluencerSummary> search(SearchCriteria criteria);
}
