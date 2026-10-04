package com.influenceiq.crm.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.influenceiq.crm.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/**
 * Write endpoints end to end. Demo data is OFF here, so this runs in its own (empty) database and never changes
 * the counts other tests expect. Each test uses its own handles.
 */
@SpringBootTest(properties = "app.demo-data.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class InfluencerWriteApiTest {

    @Autowired MockMvcTester mvc;

    /** A valid create/edit body; Java text block with %s placeholders. */
    private static String body(String handle, int followers, Integer reel, Integer version) {
        return """
                {"handle": "%s", "name": "Test Creator", "cities": ["chandigarh"], "stateOnly": [],
                 "categories": ["Jewellery"], "languages": ["Hindi"], "hashtags": ["#Kundan"],
                 "followers": %d, "engagementRate": 6.2, "avgLikes": 500, "avgComments": 40,
                 "storyInr": 1500, "reelInr": %s, "postInr": null, "version": %s}"""
                .formatted(handle, followers, reel, version);
    }

    private MvcTestResult post(String json) {
        return mvc.post().uri("/api/influencers").contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private static <T> T read(MvcTestResult r, String path) throws UnsupportedEncodingException {
        return JsonPath.read(r.getResponse().getContentAsString(), path);
    }

    @Test
    void createReturns201WithLocationAndNormalizedProfile() throws Exception {
        MvcTestResult r = post(body("@New.Creator", 5000, 4000, null));

        assertThat(r).hasStatus(HttpStatus.CREATED);
        int id = read(r, "$.id");
        assertThat(r.getResponse().getHeader("Location")).isEqualTo("/api/influencers/" + id);
        assertThat(r).bodyJson()
                .hasPathSatisfying("$.handle", v -> assertThat(v).isEqualTo("new.creator"))
                .hasPathSatisfying("$.states", v -> assertThat(v).asArray().containsExactly("Chandigarh"))
                .hasPathSatisfying("$.currentRates.reelInr", v -> assertThat(v).isEqualTo(4000))
                .hasPathSatisfying("$.version", v -> assertThat(v).isEqualTo(0));
    }

    @Test
    void duplicateHandleIs409WithTheExistingId() throws Exception {
        int id = read(post(body("dupe_check", 1000, null, null)), "$.id");

        MvcTestResult again = post(body("@DUPE_CHECK", 2000, null, null));
        assertThat(again).hasStatus(HttpStatus.CONFLICT);
        assertThat((Integer) read(again, "$.existingId")).isEqualTo(id);
    }

    @Test
    void invalidInputIs400WithEveryProblemListed() throws Exception {
        String bad = body("ok_handle", 1000, null, null).replace("[\"chandigarh\"]", "[\"Atlantis\"]")
                .replace("[\"Jewellery\"]", "[\"Underwater\"]");
        MvcTestResult r = post(bad);
        assertThat(r).hasStatus(HttpStatus.BAD_REQUEST);
        List<String> errors = read(r, "$.errors");
        assertThat(errors).containsExactly("Unknown city: Atlantis", "Unknown category: Underwater");

        assertThat(post("{ not json")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void editKeepsFreshnessAndRateHistoryRules() throws Exception {
        MvcTestResult created = post(body("editable_one", 5000, 4000, null));
        int id = read(created, "$.id");
        String firstMetricsAt = read(created, "$.metrics.updatedAt");
        String uri = "/api/influencers/" + id;

        // change followers and the reel price
        Thread.sleep(5);
        MvcTestResult edited = put(uri, body("editable_one", 6000, 4500, 0));
        assertThat(edited).hasStatusOk();
        int v1 = read(edited, "$.version");
        assertThat(v1).isGreaterThan(0); // opaque token: it only has to change on every save
        assertThat((String) read(edited, "$.metrics.updatedAt")).isNotEqualTo(firstMetricsAt); // numbers changed
        assertThat((List<?>) read(edited, "$.rateHistory")).hasSize(2);                        // old price kept
        assertThat((Integer) read(edited, "$.rateHistory[1].reelInr")).isEqualTo(4000);

        // same numbers and prices again: nothing should move
        String secondMetricsAt = read(edited, "$.metrics.updatedAt");
        MvcTestResult same = put(uri, body("editable_one", 6000, 4500, v1));
        assertThat((String) read(same, "$.metrics.updatedAt")).isEqualTo(secondMetricsAt);
        assertThat((List<?>) read(same, "$.rateHistory")).hasSize(2);
    }

    @Test
    void staleVersionIs409() throws Exception {
        int id = read(post(body("lock_test", 5000, null, null)), "$.id");
        put("/api/influencers/" + id, body("lock_test", 5100, null, 0)); // someone saves: version 0 -> 1

        MvcTestResult stale = put("/api/influencers/" + id, body("lock_test", 9999, null, 0)); // still holding version 0
        assertThat(stale).hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.get().uri("/api/influencers/" + id).exchange()).bodyJson()
                .hasPathSatisfying("$.metrics.followers", f -> assertThat(f).isEqualTo(5100)); // not overwritten
    }

    @Test
    void priceOnlyEditStillBumpsTheVersion() throws Exception {
        int id = read(post(body("price_only", 5000, 4000, null)), "$.id");
        String uri = "/api/influencers/" + id;

        MvcTestResult edited = put(uri, body("price_only", 5000, 4500, 0)); // same numbers, new reel price
        assertThat((Integer) read(edited, "$.version")).isGreaterThan(0);
        assertThat(put(uri, body("price_only", 5000, 5000, 0))).hasStatus(HttpStatus.CONFLICT); // stale: lost update caught
    }

    @Test
    void notesAndStatus() throws Exception {
        int id = read(post(body("status_test", 3000, null, null)), "$.id");
        String uri = "/api/influencers/" + id;

        assertThat(put(uri + "/notes", "{\"notes\": \"  Prefers WhatsApp  \"}")).bodyJson()
                .hasPathSatisfying("$.notes", n -> assertThat(n).isEqualTo("Prefers WhatsApp"));

        assertThat(put(uri + "/status", "{\"status\": \"BANNED\"}")).hasStatus(HttpStatus.BAD_REQUEST); // reason required
        assertThat(put(uri + "/status", "{\"status\": \"BANNED\", \"reason\": \"Fake followers\"}")).bodyJson()
                .hasPathSatisfying("$.status", s -> assertThat(s).isEqualTo("BANNED"));

        // banned influencers are hidden from search unless asked for
        assertThat(mvc.get().uri("/api/influencers?q=status_test").exchange()).bodyJson()
                .hasPathSatisfying("$.total", t -> assertThat(t).isEqualTo(0));
        assertThat(mvc.get().uri("/api/influencers?q=status_test&status=BANNED").exchange()).bodyJson()
                .hasPathSatisfying("$.total", t -> assertThat(t).isEqualTo(1));
    }
}
