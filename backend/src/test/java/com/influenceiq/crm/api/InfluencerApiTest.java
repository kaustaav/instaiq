package com.influenceiq.crm.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.influenceiq.crm.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

/**
 * The HTTP API end to end: the whole app, a throwaway Postgres, and the 500 demo influencers loaded into it.
 * Expected counts match the UI's own filter logic on the same data (frontend/src/lib/search.ts), so the
 * API and the prototype agree.
 */
@SpringBootTest(properties = "app.demo-data.enabled=true")
@AutoConfigureMockMvc // HTTP requests without a real server/port
@Import(TestcontainersConfiguration.class)
class InfluencerApiTest {

    @Autowired MockMvcTester mvc;

    @Test
    void referenceDataWithEtag() {
        var first = mvc.get().uri("/api/reference").exchange();
        assertThat(first).hasStatusOk()
                .bodyJson().extractingPath("$.categories[0]").isEqualTo("Jewellery");
        String etag = first.getResponse().getHeader("ETag");
        assertThat(etag).isNotBlank();

        // the browser re-checks with the fingerprint; unchanged data -> 304, no body
        assertThat(mvc.get().uri("/api/reference").header("If-None-Match", etag).exchange())
                .hasStatus(HttpStatus.NOT_MODIFIED);
    }

    @Test
    void searchFiltersMatchTheUi() {
        assertTotal("/api/influencers", 500);
        assertTotal("/api/influencers?loc=state:Punjab", 95);               // includes state-only profiles
        assertTotal("/api/influencers?loc=state:Punjab&cat=Jewellery", 17);
        assertTotal("/api/influencers?cat=Jewellery&fmin=5000&er=7", 22);
        assertTotal("/api/influencers?q=priya", 1);
        assertTotal("/api/influencers?q=jewel", 86);                       // name, handle and inside hashtags
        assertTotal("/api/influencers?q=bridal", 54);
    }

    @Test
    void wordsCanAppearAnywhereAndResultsAreRankedByRelevance() {
        assertThat(mvc.get().uri("/api/influencers?q=bridal chandigarh").exchange())
                .bodyJson().extractingPath("$.items[0].handle").isEqualTo("priyajewels");
    }

    @Test
    void idsOfEveryMatchForBulkActions() {
        assertThat(mvc.get().uri("/api/influencers/ids?loc=state:Punjab").exchange()).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.length()", n -> assertThat(n).isEqualTo(95)); // all 95, not one page
    }

    @Test
    void pagesOfAtMost100() {
        assertThat(mvc.get().uri("/api/influencers?page=5").exchange()).bodyJson()
                .hasPathSatisfying("$.items.length()", n -> assertThat(n).isEqualTo(100))
                .hasPathSatisfying("$.totalPages", n -> assertThat(n).isEqualTo(5));
        assertThat(mvc.get().uri("/api/influencers?size=500").exchange()).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void profileWithDerivedStatesAndCurrentRates() {
        assertThat(mvc.get().uri("/api/influencers/1").exchange()).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.handle", h -> assertThat(h).isEqualTo("priyajewels"))
                .hasPathSatisfying("$.states", s -> assertThat(s).asArray().containsExactly("Chandigarh", "Punjab"))
                .hasPathSatisfying("$.currentRates.reelInr", r -> assertThat(r).isEqualTo(5000));
    }

    @Test
    void errorsAreProblemDetails() {
        assertThat(mvc.get().uri("/api/influencers/999999").exchange())
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.title").isEqualTo("Not found");
        assertThat(mvc.get().uri("/api/influencers/abc").exchange()).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.get().uri("/api/influencers?loc=planet:Mars").exchange())
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson().extractingPath("$.errors[0]").asString().contains("city:Name");
    }

    private void assertTotal(String uri, int expected) {
        assertThat(mvc.get().uri(uri).exchange()).as(uri).hasStatusOk()
                .bodyJson().extractingPath("$.total").isEqualTo(expected);
    }
}
