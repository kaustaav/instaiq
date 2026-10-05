package com.influenceiq.crm.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.influenceiq.crm.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/** Adding custom niches and languages. Demo data off (same empty database as InfluencerWriteApiTest). */
@SpringBootTest(properties = "app.demo-data.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ReferenceWriteApiTest {

    @Autowired MockMvcTester mvc;

    private MvcTestResult add(String list, String value) {
        return mvc.post().uri("/api/reference/" + list).contentType(MediaType.APPLICATION_JSON)
                .content("{\"value\": \"" + value + "\"}").exchange();
    }

    @Test
    void newNicheIsAddedOnceAndListedLast() {
        assertThat(add("categories", "Home & Decor")).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.created", v -> assertThat(v).isEqualTo(true));

        // same value, other spelling: no duplicate, the stored spelling comes back
        assertThat(add("categories", "  home   &  DECOR ")).hasStatus(HttpStatus.OK).bodyJson()
                .hasPathSatisfying("$.value", v -> assertThat(v).isEqualTo("Home & Decor"))
                .hasPathSatisfying("$.created", v -> assertThat(v).isEqualTo(false));
        assertThat(add("categories", "jewellery")).hasStatus(HttpStatus.OK).bodyJson()
                .hasPathSatisfying("$.value", v -> assertThat(v).isEqualTo("Jewellery")); // built-in one

        assertThat(mvc.get().uri("/api/reference").exchange()).bodyJson()
                .hasPathSatisfying("$.categories[-1]", v -> assertThat(v).isEqualTo("Home & Decor"));
    }

    @Test
    void newLanguageCanBeUsedOnAnInfluencerRightAway() {
        assertThat(add("languages", "Garhwali")).hasStatus(HttpStatus.CREATED);

        MvcTestResult created = mvc.post().uri("/api/influencers").contentType(MediaType.APPLICATION_JSON).content("""
                {"handle": "garhwali_creator", "name": "Test Creator", "cities": [], "stateOnly": ["Uttarakhand"],
                 "categories": ["Travel"], "languages": ["garhwali"], "followers": 1200}""").exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.languages", v -> assertThat(v).asArray().containsExactly("Garhwali"));
    }

    @Test
    void lowercaseWordsAreCapitalizedOthersKept() {
        assertThat(add("languages", "jaunsari")).bodyJson()
                .hasPathSatisfying("$.value", v -> assertThat(v).isEqualTo("Jaunsari"));
        assertThat(add("categories", "DIY crafts")).bodyJson()
                .hasPathSatisfying("$.value", v -> assertThat(v).isEqualTo("DIY Crafts"));
    }

    @Test
    void invalidValuesAre400() {
        assertThat(add("categories", "")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(add("categories", "<script>")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(add("languages", "x".repeat(41))).hasStatus(HttpStatus.BAD_REQUEST);
    }
}
