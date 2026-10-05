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

/** Campaign status machine and member stages (docs/DATA_MODEL.md). Demo data off; own influencers per test. */
@SpringBootTest(properties = "app.demo-data.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CampaignWorkflowApiTest {

    @Autowired MockMvcTester mvc;

    private MvcTestResult send(String method, String uri, String json) {
        var req = method.equals("POST") ? mvc.post().uri(uri) : mvc.put().uri(uri);
        return req.contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private static <T> T read(MvcTestResult r, String path) throws UnsupportedEncodingException {
        return JsonPath.read(r.getResponse().getContentAsString(), path);
    }

    private int influencer(String handle) throws Exception {
        return read(send("POST", "/api/influencers", """
                {"handle": "%s", "name": "Name %s", "cities": ["Pune"], "categories": ["Food"], "followers": 4000}"""
                .formatted(handle, handle)), "$.id");
    }

    private int campaign(boolean withDates) throws Exception {
        return read(send("POST", "/api/campaigns", """
                {"name": "Workflow", "brand": "Acme Tea", "targetInfluencers": 2 %s}"""
                .formatted(withDates ? ", \"startDate\": \"2026-11-01\", \"endDate\": \"2026-11-30\"" : "")), "$.id");
    }

    private MvcTestResult status(int id, String action, String reason) {
        return send("POST", "/api/campaigns/" + id + "/status", reason == null
                ? "{\"action\": \"%s\"}".formatted(action)
                : "{\"action\": \"%s\", \"reason\": \"%s\"}".formatted(action, reason));
    }

    private MvcTestResult stage(int id, int influencerId, String to, String reason) {
        return send("PUT", "/api/campaigns/%d/members/%d/stage".formatted(id, influencerId), reason == null
                ? "{\"stage\": \"%s\"}".formatted(to)
                : "{\"stage\": \"%s\", \"reason\": \"%s\"}".formatted(to, reason));
    }

    @Test
    void activateNeedsDatesAndMembersAndListsBothBlockers() throws Exception {
        int id = campaign(false);
        MvcTestResult blocked = status(id, "ACTIVATE", null);
        assertThat(blocked).hasStatus(HttpStatus.CONFLICT);
        assertThat((List<String>) read(blocked, "$.errors")).containsExactly("Set start and end dates", "Add at least one influencer");
    }

    @Test
    void fullLifecycleWithReadOnlyStates() throws Exception {
        int a = influencer("wf_a");
        int id = campaign(true);
        send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(a));

        assertThat(status(id, "ACTIVATE", null)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("ACTIVE"));
        assertThat(status(id, "ACTIVATE", null)).hasStatus(HttpStatus.CONFLICT); // not from ACTIVE

        // complete is blocked while a member is undecided, with their name
        MvcTestResult blocked = status(id, "COMPLETE", null);
        assertThat((List<String>) read(blocked, "$.errors"))
                .containsExactly("Name wf_a: still shortlisted (decline or agree terms)");

        stage(id, a, "DECLINED", null);
        assertThat(status(id, "COMPLETE", null)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("COMPLETED"));

        // completed = read-only: no edits, no members, no stage changes
        int version = read(mvc.get().uri("/api/campaigns/" + id).exchange(), "$.version");
        MvcTestResult edit = send("PUT", "/api/campaigns/" + id, """
                {"name": "x", "brand": "y", "targetInfluencers": 1, "version": %d}""".formatted(version));
        assertThat(edit).hasStatus(HttpStatus.CONFLICT);
        assertThat((List<String>) read(edit, "$.errors"))
                .containsExactly("This campaign is completed and read-only. Reopen it to make changes.");
        assertThat(send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(a)))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(stage(id, a, "SHORTLISTED", "changed mind")).hasStatus(HttpStatus.CONFLICT);

        // reopen needs a reason
        assertThat(status(id, "REOPEN", null)).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(status(id, "REOPEN", "Brand extended the campaign")).bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("ACTIVE"))
                .hasPathSatisfying("$.statusReason", v -> assertThat(v).isEqualTo("Brand extended the campaign"));

        // cancel (reason) -> archive -> unarchive returns to CANCELLED
        assertThat(status(id, "CANCEL", "Budget cut")).bodyJson().hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("CANCELLED"));
        assertThat(status(id, "ARCHIVE", null)).bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("ARCHIVED"))
                .hasPathSatisfying("$.archivedFrom", v -> assertThat(v).isEqualTo("CANCELLED"));
        assertThat(status(id, "UNARCHIVE", "Needed for reporting")).bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("CANCELLED"))
                .hasPathSatisfying("$.archivedFrom", v -> assertThat(v).isNull());

        assertThat(send("POST", "/api/campaigns/" + id + "/status", "{\"action\": \"EXPLODE\"}")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void memberStageMoves() throws Exception {
        int a = influencer("wf_stage");
        int id = campaign(true);
        send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(a));

        assertThat(stage(id, a, "NEGOTIATING", null)).hasStatus(HttpStatus.CONFLICT); // can't skip contacted
        assertThat(stage(id, a, "AGREED", null)).hasStatus(HttpStatus.CONFLICT);      // agreeing terms is separate
        assertThat(stage(id, a, "CONTACTED", null)).hasStatusOk();
        assertThat(stage(id, a, "NEGOTIATING", null)).hasStatusOk();

        assertThat(stage(id, a, "CONTACTED", null)).hasStatus(HttpStatus.BAD_REQUEST); // a step back needs a reason
        MvcTestResult back = stage(id, a, "CONTACTED", "Waiting for their rate card");
        assertThat((String) read(back, "$.members[0].stage")).isEqualTo("CONTACTED");
        assertThat((String) read(back, "$.members[0].stageReason")).isEqualTo("Waiting for their rate card");

        assertThat(stage(id, a, "DECLINED", null)).hasStatusOk();                           // reason optional
        assertThat(stage(id, a, "CONTACTED", null)).hasStatus(HttpStatus.CONFLICT);        // only re-shortlist
        assertThat(stage(id, a, "SHORTLISTED", null)).hasStatus(HttpStatus.BAD_REQUEST);   // with a reason
        assertThat(stage(id, a, "SHORTLISTED", "Available again")).bodyJson()
                .hasPathSatisfying("$.members[0].displayStage", v -> assertThat(v).isEqualTo("SHORTLISTED"));

        assertThat(stage(id, 987654, "CONTACTED", null)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void memberNotes() throws Exception {
        int a = influencer("wf_notes");
        int id = campaign(true);
        send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(a));
        assertThat(send("PUT", "/api/campaigns/%d/members/%d/notes".formatted(id, a), "{\"notes\": \"  DM sent Monday \"}"))
                .bodyJson().hasPathSatisfying("$.members[0].notes", v -> assertThat(v).isEqualTo("DM sent Monday"));
    }
}
