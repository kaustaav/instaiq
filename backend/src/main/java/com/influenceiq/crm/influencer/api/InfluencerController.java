package com.influenceiq.crm.influencer.api;

import com.influenceiq.crm.influencer.InfluencerQueryService;
import com.influenceiq.crm.influencer.search.InfluencerSearchService;
import com.influenceiq.crm.influencer.search.InfluencerSummary;
import com.influenceiq.crm.influencer.search.SearchPage;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP layer only: translate requests into service calls and results into JSON. No business rules here;
 * errors are thrown by services and turned into JSON by ApiExceptionHandler.
 */
@RestController // = @Controller + every method's return value is written as JSON
@RequestMapping("/api/influencers")
@RequiredArgsConstructor
public class InfluencerController {

    private final InfluencerSearchService search; // the interface, not the Postgres class
    private final InfluencerQueryService queries;

    /** GET /api/influencers?q=&loc=&cat=&lang=&fmin=&fmax=&er=&status=&page=&size= */
    @GetMapping
    public SearchPage<InfluencerSummary> search(SearchRequest request) {
        return search.search(request.toCriteria());
    }

    /** GET /api/influencers/42 */
    @GetMapping("/{id}")
    public InfluencerResponse get(@PathVariable long id) {
        return queries.get(id);
    }
}
