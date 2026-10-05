package com.influenceiq.crm.reference.api;

import com.influenceiq.crm.common.CurrentUser;
import com.influenceiq.crm.reference.ReferenceData;
import com.influenceiq.crm.reference.ReferenceDataService;
import com.influenceiq.crm.reference.ReferenceDataService.Added;
import com.influenceiq.crm.reference.ReferenceDataService.TaxonomyType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

/**
 * GET /api/reference: everything the UI needs for dropdowns and chips, in one small response.
 * POST /api/reference/categories and /languages: add a custom niche or language.
 * <p>
 * ETag: the response carries a fingerprint of the data. The browser sends it back (If-None-Match); if nothing
 * changed we answer "304 Not Modified" with no body. That's what makes "re-check on tab focus" nearly free.
 */
@RestController
@RequestMapping("/api/reference")
@RequiredArgsConstructor
public class ReferenceController {

    private final ReferenceDataService referenceData;
    private final CurrentUser currentUser;

    public record TaxonomyRequest(String value) {}

    public record StateCities(String state, List<String> cities) {}

    public record ReferenceResponse(List<StateCities> locations, List<String> categories, List<String> languages) {}

    @GetMapping
    public ResponseEntity<ReferenceResponse> get(WebRequest request) {
        ReferenceData data = referenceData.get();
        String etag = "\"" + Integer.toHexString(data.hashCode()) + "\""; // same data -> same fingerprint
        if (request.checkNotModified(etag)) {
            return null; // Spring has already set "304 Not Modified"
        }

        Map<String, List<String>> byState = new TreeMap<>();
        data.canonicalCity().values().forEach(city ->
                byState.computeIfAbsent(data.stateOfCity(city).orElseThrow(), s -> new ArrayList<>()).add(city));
        List<StateCities> locations = byState.entrySet().stream()
                .map(e -> new StateCities(e.getKey(), e.getValue().stream().sorted().toList()))
                .toList();

        ReferenceResponse body = new ReferenceResponse(
                locations, List.copyOf(data.categories().values()), List.copyOf(data.languages().values()));
        return ResponseEntity.ok()
                .eTag(etag)
                .cacheControl(CacheControl.noCache()) // "may cache, but must re-check (using the ETag) each time"
                .body(body);
    }

    /** 201 when added, 200 when it already existed; either way the body has the stored spelling to use. */
    @PostMapping("/categories")
    public ResponseEntity<Added> addCategory(@RequestBody TaxonomyRequest body) {
        return added(referenceData.addTaxonomy(TaxonomyType.CATEGORY, body.value(), currentUser.name()));
    }

    @PostMapping("/languages")
    public ResponseEntity<Added> addLanguage(@RequestBody TaxonomyRequest body) {
        return added(referenceData.addTaxonomy(TaxonomyType.LANGUAGE, body.value(), currentUser.name()));
    }

    private static ResponseEntity<Added> added(Added a) {
        return ResponseEntity.status(a.created() ? HttpStatus.CREATED : HttpStatus.OK).body(a);
    }
}
