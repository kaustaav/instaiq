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

/** Campaigns and members end to end. Demo data off; each test creates its own influencers and campaigns. */
@SpringBootTest(properties = "app.demo-data.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CampaignApiTest {

    @Autowired MockMvcTester mvc;

    private MvcTestResult send(String method, String uri, String json) {
        var req = switch (method) {
            case "POST" -> mvc.post().uri(uri);
            case "PUT" -> mvc.put().uri(uri);
            default -> throw new IllegalArgumentException(method);
        };
        return req.contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private static <T> T read(MvcTestResult r, String path) throws UnsupportedEncodingException {
        return JsonPath.read(r.getResponse().getContentAsString(), path);
    }

    private int influencer(String handle, String status) throws Exception {
        int id = read(send("POST", "/api/influencers", """
                {"handle": "%s", "name": "Name %s", "cities": ["Pune"], "categories": ["Food"], "followers": 4000}"""
                .formatted(handle, handle)), "$.id");
        if (status != null) send("PUT", "/api/influencers/" + id + "/status", "{\"status\": \"%s\", \"reason\": \"test\"}".formatted(status));
        return id;
    }

    private int campaign(String name) throws Exception {
        return read(send("POST", "/api/campaigns", """
                {"name": "%s", "brand": "Acme Tea", "startDate": "2026-11-01", "endDate": "2026-11-30", "budgetInr": 200000,
                 "targetInfluencers": 10, "targetReels": 12, "targetStories": 20}"""
                .formatted(name)), "$.id");
    }

    @Test
    void createValidateAndEdit() throws Exception {
        MvcTestResult created = send("POST", "/api/campaigns", """
                {"name": " Diwali push ", "brand": "Acme Tea", "brief": "Festive reels", "startDate": "2026-10-20",
                 "endDate": "2026-11-05", "budgetInr": 150000, "targetInfluencers": 8, "targetReels": 10}""");
        assertThat(created).hasStatus(HttpStatus.CREATED);
        int id = read(created, "$.id");
        assertThat(created.getResponse().getHeader("Location")).isEqualTo("/api/campaigns/" + id);
        assertThat(created).bodyJson()
                .hasPathSatisfying("$.name", v -> assertThat(v).isEqualTo("Diwali push"))
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("DRAFT"))
                .hasPathSatisfying("$.targets.influencers", v -> assertThat(v).isEqualTo(8))
                .hasPathSatisfying("$.targets.reels", v -> assertThat(v).isEqualTo(10))
                .hasPathSatisfying("$.targets.stories", v -> assertThat(v).isNull()) // optional
                .hasPathSatisfying("$.members", v -> assertThat(v).asArray().isEmpty());

        MvcTestResult bad = send("POST", "/api/campaigns", """
                {"name": "", "brand": " ", "startDate": "2026-11-05", "endDate": "2026-10-20", "budgetInr": -1,
                 "targetReels": -2}""");
        assertThat(bad).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat((List<String>) read(bad, "$.errors")).containsExactly(
                "Name is required", "Brand is required", "End date is before start date", "Budget can't be negative",
                "Number of influencers is required (at least 1)", "Number of reels can't be negative");

        String uri = "/api/campaigns/" + id;
        String edit = """
                {"name": "Diwali push", "brand": "Acme Tea", "budgetInr": 180000, "targetInfluencers": 8, "version": %d}""";
        assertThat(send("PUT", uri, edit.replace(", \"version\": %d", ""))).hasStatus(HttpStatus.BAD_REQUEST); // no version
        MvcTestResult edited = send("PUT", uri, edit.formatted(0));
        assertThat(edited).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.budgetInr", v -> assertThat(v).isEqualTo(180000))
                .hasPathSatisfying("$.brief", v -> assertThat(v).isNull()); // full edit: what's not sent is cleared
        assertThat(send("PUT", uri, edit.formatted(0))).hasStatus(HttpStatus.CONFLICT); // stale version
    }

    @Test
    void addMembersSkipsDuplicatesAndReportsWhoCantBeAdded() throws Exception {
        int a = influencer("camp_a", null);
        int b = influencer("camp_b", null);
        int held = influencer("camp_held", "ON_HOLD");
        int banned = influencer("camp_banned", "BANNED");
        int id = campaign("Members test");
        String uri = "/api/campaigns/" + id + "/members";

        MvcTestResult r = send("POST", uri, "{\"influencerIds\": [%d, %d, %d, %d, %d, 99999999]}".formatted(a, b, a, held, banned));
        assertThat(r).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.added", v -> assertThat(v).isEqualTo(3))       // a, b, held (a only once)
                .hasPathSatisfying("$.alreadyIn", v -> assertThat(v).isEqualTo(0))
                .hasPathSatisfying("$.onHold", v -> assertThat(v).asArray().containsExactly("Name camp_held"));
        assertThat((List<String>) read(r, "$.notAdded[*].reason"))
                .containsExactly("Influencer is banned", "Influencer not found");

        assertThat(send("POST", uri, "{\"influencerIds\": [%d]}".formatted(a))).bodyJson()
                .hasPathSatisfying("$.alreadyIn", v -> assertThat(v).isEqualTo(1));      // one influencer once per campaign
        assertThat(send("POST", uri, "{\"influencerIds\": []}")).hasStatus(HttpStatus.BAD_REQUEST);

        MvcTestResult detail = mvc.get().uri("/api/campaigns/" + id).exchange();
        assertThat((List<Integer>) read(detail, "$.members[*].influencer.id")).containsExactly(a, b, held); // in order added
        assertThat((List<String>) read(detail, "$.members[*].displayStage")).containsOnly("SHORTLISTED");
        assertThat((String) read(detail, "$.members[0].influencer.handle")).isEqualTo("camp_a");

        // the list shows the counts
        MvcTestResult list = mvc.get().uri("/api/campaigns").exchange();
        assertThat((List<Integer>) read(list, "$[?(@.id == " + id + ")].memberCount")).containsExactly(3);
        assertThat((List<Integer>) read(list, "$[?(@.id == " + id + ")].stageCounts.SHORTLISTED")).containsExactly(3);
    }

    @Test
    void influencerCampaignsListsWhereTheyAre() throws Exception {
        int a = influencer("camp_history", null);
        int first = campaign("History one");
        int second = campaign("History two");
        campaign("Not in this one");
        send("POST", "/api/campaigns/" + first + "/members", "{\"influencerIds\": [%d]}".formatted(a));
        send("POST", "/api/campaigns/" + second + "/members", "{\"influencerIds\": [%d]}".formatted(a));

        MvcTestResult r = mvc.get().uri("/api/influencers/" + a + "/campaigns").exchange();
        assertThat((List<Integer>) read(r, "$[*].campaignId")).containsExactly(second, first); // newest first
        assertThat((List<String>) read(r, "$[*].displayStage")).containsOnly("SHORTLISTED");
        assertThat(mvc.get().uri("/api/influencers/98765432/campaigns").exchange()).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void removeMember() throws Exception {
        int a = influencer("camp_remove", null);
        int id = campaign("Remove test");
        send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(a));

        assertThat(mvc.delete().uri("/api/campaigns/" + id + "/members/" + a).exchange()).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.members", v -> assertThat(v).asArray().isEmpty());
        assertThat(mvc.delete().uri("/api/campaigns/" + id + "/members/" + a).exchange()).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void duplicateCopiesSetupNotPipeline() throws Exception {
        int a = influencer("camp_dup", null);
        int id = campaign("Original");
        send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(a));

        MvcTestResult copy = mvc.post().uri("/api/campaigns/" + id + "/duplicate").exchange();
        assertThat(copy).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.name", v -> assertThat(v).isEqualTo("Original (copy)"))
                .hasPathSatisfying("$.budgetInr", v -> assertThat(v).isEqualTo(200000))
                .hasPathSatisfying("$.startDate", v -> assertThat(v).isNull())
                .hasPathSatisfying("$.targets.influencers", v -> assertThat(v).isEqualTo(10))
                .hasPathSatisfying("$.targets.stories", v -> assertThat(v).isEqualTo(20))
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("DRAFT"))
                .hasPathSatisfying("$.members", v -> assertThat(v).asArray().isEmpty());
        assertThat(mvc.get().uri("/api/campaigns/987654").exchange()).hasStatus(HttpStatus.NOT_FOUND);
    }
}
