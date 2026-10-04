package com.influenceiq.crm.influencer.api;

import com.influenceiq.crm.common.CurrentUser;
import com.influenceiq.crm.common.Origin;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerQueryService;
import com.influenceiq.crm.ingestion.InfluencerIngestionService;
import com.influenceiq.crm.influencer.search.InfluencerSearchService;
import com.influenceiq.crm.influencer.search.InfluencerSummary;
import com.influenceiq.crm.influencer.search.SearchPage;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final InfluencerIngestionService ingestion; // all writes go through here
    private final CurrentUser currentUser;

    /** GET /api/influencers?q=&loc=&cat=&lang=&fmin=&fmax=&er=&status=&page=&size= */
    @GetMapping
    public SearchPage<InfluencerSummary> search(SearchRequest request) {
        return search.search(request.toCriteria());
    }

    /** GET /api/influencers/ids?...same filters...: every matching id (at most 5000), for "Add all to campaign". */
    @GetMapping("/ids")
    public List<Long> ids(SearchRequest request) {
        return search.searchIds(request.toCriteria());
    }

    /** GET /api/influencers/42 */
    @GetMapping("/{id}")
    public InfluencerResponse get(@PathVariable long id) {
        return queries.get(id);
    }

    /** POST /api/influencers -> 201 Created, Location: /api/influencers/{newId}, body = the new profile. */
    @PostMapping
    public ResponseEntity<InfluencerResponse> create(@RequestBody InfluencerRequest body) {
        Influencer created = ingestion.create(body.toInput(), Origin.MANUAL, currentUser.name());
        return ResponseEntity.created(URI.create("/api/influencers/" + created.getId())).body(queries.get(created.getId()));
    }

    /** PUT /api/influencers/42: full edit. The body must carry the version the client loaded. */
    @PutMapping("/{id}")
    public InfluencerResponse update(@PathVariable long id, @RequestBody InfluencerRequest body) {
        if (body.version() == null) {
            throw new ValidationException("version is required (send back the version from GET)");
        }
        ingestion.update(id, body.version(), body.toInput(), Origin.MANUAL, currentUser.name());
        return queries.get(id);
    }

    @PutMapping("/{id}/notes")
    public InfluencerResponse updateNotes(@PathVariable long id, @RequestBody NotesRequest body) {
        ingestion.updateNotes(id, body.notes(), currentUser.name());
        return queries.get(id);
    }

    @PutMapping("/{id}/status")
    public InfluencerResponse changeStatus(@PathVariable long id, @RequestBody StatusRequest body) {
        ingestion.changeStatus(id, body.status(), body.reason(), currentUser.name());
        return queries.get(id);
    }
}
