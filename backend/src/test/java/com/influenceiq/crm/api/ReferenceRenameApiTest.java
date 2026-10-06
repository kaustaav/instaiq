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

/** Fixing custom niches/languages: rename everywhere, merge into an existing one, delete only when unused. */
@SpringBootTest(properties = "app.demo-data.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ReferenceRenameApiTest {

    @Autowired MockMvcTester mvc;

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private static <T> T read(MvcTestResult r, String path) throws UnsupportedEncodingException {
        return JsonPath.read(r.getResponse().getContentAsString(), path);
    }

    private int influencer(String handle, String categories) throws Exception {
        return read(post("/api/influencers", """
                {"handle": "%s", "name": "N %s", "cities": ["Pune"], "categories": %s, "followers": 1000}"""
                .formatted(handle, handle, categories)), "$.id");
    }

    private MvcTestResult get(int id) {
        return mvc.get().uri("/api/influencers/" + id).exchange();
    }

    @Test
    void renameFixesATypoEverywhere() throws Exception {
        post("/api/reference/categories", "{\"value\": \"Pet Carre\"}");
        int a = influencer("rn_typo", "[\"Pet Carre\", \"Food\"]");
        int versionBefore = read(get(a), "$.version");

        MvcTestResult r = post("/api/reference/categories/rename", "{\"from\": \"pet carre\", \"to\": \"pet care\"}");
        assertThat(r).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.value", v -> assertThat(v).isEqualTo("Pet Care"))     // capitalized like adding
                .hasPathSatisfying("$.merged", v -> assertThat(v).isEqualTo(false))
                .hasPathSatisfying("$.influencersUpdated", v -> assertThat(v).isEqualTo(1));

        MvcTestResult after = get(a);
        assertThat((List<String>) read(after, "$.categories")).containsExactly("Pet Care", "Food"); // order kept
        assertThat((Integer) read(after, "$.version")).isGreaterThan(versionBefore);             // concurrent edits -> 409
        List<String> all = read(mvc.get().uri("/api/reference").exchange(), "$.categories");
        assertThat(all).contains("Pet Care").doesNotContain("Pet Carre");

        // the custom list shows it with its usage
        MvcTestResult custom = mvc.get().uri("/api/reference/custom").exchange();
        assertThat((List<Integer>) read(custom, "$.categories[?(@.value == 'Pet Care')].usedBy")).containsExactly(1);
    }

    @Test
    void renamingOntoAnExistingNameMerges() throws Exception {
        post("/api/reference/categories", "{\"value\": \"Fitnes\"}");
        int both = influencer("rn_both", "[\"Fitnes\", \"Fitness\"]");
        int one = influencer("rn_one", "[\"Fitnes\"]");

        MvcTestResult r = post("/api/reference/categories/rename", "{\"from\": \"Fitnes\", \"to\": \"fitness\"}");
        assertThat(r).bodyJson()
                .hasPathSatisfying("$.value", v -> assertThat(v).isEqualTo("Fitness"))
                .hasPathSatisfying("$.merged", v -> assertThat(v).isEqualTo(true))
                .hasPathSatisfying("$.influencersUpdated", v -> assertThat(v).isEqualTo(2));
        assertThat((List<String>) read(get(both), "$.categories")).containsExactly("Fitness"); // no duplicate
        assertThat((List<String>) read(get(one), "$.categories")).containsExactly("Fitness");
        assertThat((List<String>) read(mvc.get().uri("/api/reference").exchange(), "$.categories")).doesNotContain("Fitnes");
    }

    @Test
    void languagesWorkTheSameWay() throws Exception {
        post("/api/reference/languages", "{\"value\": \"Garwali\"}");
        assertThat(post("/api/reference/languages/rename", "{\"from\": \"Garwali\", \"to\": \"Garhwali Pahari\"}")).bodyJson()
                .hasPathSatisfying("$.value", v -> assertThat(v).isEqualTo("Garhwali Pahari"));
    }

    @Test
    void builtInsAreProtectedAndBadInputIsRefused() throws Exception {
        MvcTestResult builtIn = post("/api/reference/categories/rename", "{\"from\": \"Jewellery\", \"to\": \"Jewelry\"}");
        assertThat(builtIn).hasStatus(HttpStatus.CONFLICT);
        assertThat((List<String>) read(builtIn, "$.errors")).containsExactly("\"Jewellery\" is built in and can't be changed");
        assertThat(mvc.delete().uri("/api/reference/categories?value=Jewellery").exchange()).hasStatus(HttpStatus.CONFLICT);

        assertThat(post("/api/reference/categories/rename", "{\"from\": \"No Such Niche\", \"to\": \"X\"}"))
                .hasStatus(HttpStatus.NOT_FOUND);
        post("/api/reference/categories", "{\"value\": \"Gadgetz\"}");
        assertThat(post("/api/reference/categories/rename", "{\"from\": \"Gadgetz\", \"to\": \"<b>\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void deleteOnlyWhenUnused() throws Exception {
        post("/api/reference/categories", "{\"value\": \"Unused Niche\"}");
        post("/api/reference/categories", "{\"value\": \"Used Niche\"}");
        influencer("rn_used", "[\"Used Niche\"]");

        MvcTestResult used = mvc.delete().uri("/api/reference/categories?value=Used Niche").exchange();
        assertThat(used).hasStatus(HttpStatus.CONFLICT);
        assertThat((List<String>) read(used, "$.errors"))
                .containsExactly("\"Used Niche\" is used by 1 influencer. Rename or merge it instead.");

        assertThat(mvc.delete().uri("/api/reference/categories?value=unused niche").exchange()).hasStatus(HttpStatus.NO_CONTENT);
        assertThat((List<String>) read(mvc.get().uri("/api/reference").exchange(), "$.categories")).doesNotContain("Unused Niche");
    }

    @Test
    void anEditorHoldingTheOldVersionGetsAConflict() throws Exception {
        post("/api/reference/categories", "{\"value\": \"Cricket Fans\"}");
        int id = influencer("rn_lock", "[\"Cricket Fans\"]");
        int loaded = read(get(id), "$.version"); // someone opens the edit form

        post("/api/reference/categories/rename", "{\"from\": \"Cricket Fans\", \"to\": \"Cricket\"}");

        MvcTestResult save = mvc.put().uri("/api/influencers/" + id).contentType(MediaType.APPLICATION_JSON).content("""
                {"handle": "rn_lock", "name": "N", "cities": ["Pune"], "categories": ["Cricket Fans"], "followers": 1000,
                 "version": %d}""".formatted(loaded)).exchange();
        assertThat(save).hasStatus(HttpStatus.CONFLICT); // not a silent revert to the old name
    }
}
