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

/** Agreeing terms, deliverables and the draft review loop (campaigns step 3). Demo data off. */
@SpringBootTest(properties = "app.demo-data.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CampaignContentApiTest {

    private static final String DRIVE = "https://drive.google.com/file/d/demo/view";

    @Autowired MockMvcTester mvc;

    private MvcTestResult send(String method, String uri, String json) {
        var req = method.equals("POST") ? mvc.post().uri(uri) : mvc.put().uri(uri);
        return req.contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private static <T> T read(MvcTestResult r, String path) throws UnsupportedEncodingException {
        return JsonPath.read(r.getResponse().getContentAsString(), path);
    }

    /** A campaign with dates and one member at NEGOTIATING. Returns [campaignId, influencerId]. */
    private int[] negotiating(String handle) throws Exception {
        int inf = read(send("POST", "/api/influencers", """
                {"handle": "%s", "name": "Name %s", "cities": ["Pune"], "categories": ["Food"], "followers": 4000,
                 "storyInr": 1500, "reelInr": 4500}""".formatted(handle, handle)), "$.id");
        int id = read(send("POST", "/api/campaigns", """
                {"name": "Content", "brand": "Acme Tea", "targetInfluencers": 1, "startDate": "2026-11-01", "endDate": "2026-11-30"}"""),
                "$.id");
        send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(inf));
        for (String s : List.of("CONTACTED", "NEGOTIATING")) {
            send("PUT", "/api/campaigns/%d/members/%d/stage".formatted(id, inf), "{\"stage\": \"%s\"}".formatted(s));
        }
        return new int[] {id, inf};
    }

    private String terms(int[] ci) {
        return "/api/campaigns/%d/members/%d/terms".formatted(ci[0], ci[1]);
    }

    private String del(int[] ci, int deliverableId, String action) {
        return "/api/campaigns/%d/members/%d/deliverables/%d/%s".formatted(ci[0], ci[1], deliverableId, action);
    }

    @Test
    void agreeTermsCreatesDeliverablesAndMakesPaymentDue() throws Exception {
        int[] ci = negotiating("cc_terms");
        assertThat((Integer) read(mvc.get().uri("/api/campaigns/" + ci[0]).exchange(), "$.members[0].influencer.rates.reelInr"))
                .isEqualTo(4500); // for the suggested fee

        MvcTestResult bad = send("POST", terms(ci), "{\"compensation\": \"CASH\"}");
        assertThat(bad).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat((List<String>) read(bad, "$.errors"))
                .containsExactly("Add at least one deliverable", "Agreed fee is required for paid collaborations");

        MvcTestResult ok = send("POST", terms(ci), "{\"compensation\": \"CASH\", \"feeInr\": 9000, \"reels\": 2, \"stories\": 1}");
        assertThat(ok).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.members[0].stage", v -> assertThat(v).isEqualTo("AGREED"))
                .hasPathSatisfying("$.members[0].displayStage", v -> assertThat(v).isEqualTo("IN_PRODUCTION"))
                .hasPathSatisfying("$.members[0].paymentStatus", v -> assertThat(v).isEqualTo("DUE"))
                .hasPathSatisfying("$.budgetUsedInr", v -> assertThat(v).isEqualTo(9000));
        assertThat((List<String>) read(ok, "$.members[0].deliverables[*].type")).containsExactly("REEL", "REEL", "STORY");
        assertThat(send("POST", terms(ci), "{\"compensation\": \"CASH\", \"feeInr\": 1, \"reels\": 1}")).hasStatus(HttpStatus.CONFLICT); // already agreed

        int[] barter = negotiating("cc_barter");
        assertThat(send("POST", terms(barter), "{\"compensation\": \"BARTER\", \"feeInr\": 5000, \"posts\": 1}")).bodyJson()
                .hasPathSatisfying("$.members[0].paymentStatus", v -> assertThat(v).isEqualTo("WAIVED"))
                .hasPathSatisfying("$.members[0].agreedFeeInr", v -> assertThat(v).isNull()); // barter: no cash fee
    }

    @Test
    void draftReviewLoopThenPosted() throws Exception {
        int[] ci = negotiating("cc_loop");
        MvcTestResult agreed = send("POST", terms(ci), "{\"compensation\": \"CASH\", \"feeInr\": 6000, \"reels\": 2}");
        List<Integer> ids = read(agreed, "$.members[0].deliverables[*].id");
        int reel1 = ids.get(0);
        int reel2 = ids.get(1);
        send("POST", "/api/campaigns/" + ci[0] + "/status", "{\"action\": \"ACTIVATE\"}");

        assertThat(send("POST", del(ci, reel1, "drafts"), "{\"draftUrl\": \"not a link\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send("POST", del(ci, reel1, "review"), "{\"decision\": \"APPROVED\"}")).hasStatus(HttpStatus.CONFLICT); // nothing to review
        assertThat(send("POST", del(ci, reel1, "drafts"), "{\"draftUrl\": \"" + DRIVE + "\"}")).hasStatusOk();
        assertThat(send("POST", del(ci, reel1, "drafts"), "{\"draftUrl\": \"" + DRIVE + "\"}")).hasStatus(HttpStatus.CONFLICT); // in review

        assertThat(send("POST", del(ci, reel1, "review"), "{\"decision\": \"CHANGES_REQUESTED\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        send("POST", del(ci, reel1, "review"), "{\"decision\": \"CHANGES_REQUESTED\", \"feedback\": \"Show the label\"}");
        send("POST", del(ci, reel1, "drafts"), "{\"draftUrl\": \"" + DRIVE + "2\"}");
        MvcTestResult approved = send("POST", del(ci, reel1, "review"), "{\"decision\": \"APPROVED\"}");
        assertThat((List<Integer>) read(approved, "$.members[0].deliverables[0].revisions[*].round")).containsExactly(1, 2);
        assertThat((List<String>) read(approved, "$.members[0].deliverables[0].revisions[*].decision"))
                .containsExactly("CHANGES_REQUESTED", "APPROVED");

        MvcTestResult noLink = send("POST", del(ci, reel1, "posted"), "{\"liveUrl\": \"\"}");
        assertThat((List<String>) read(noLink, "$.errors")).containsExactly("Enter a valid live link (https://…)", "Enter the date it went live");
        String live = "https://www.instagram.com/reel/abc123/";
        assertThat(send("POST", del(ci, reel1, "posted"), "{\"liveUrl\": \"" + live + "\", \"postedAt\": \"2026-11-05\"}")).hasStatusOk();

        // the same live link can't be a second deliverable
        send("POST", del(ci, reel2, "drafts"), "{\"draftUrl\": \"" + DRIVE + "\"}");
        send("POST", del(ci, reel2, "review"), "{\"decision\": \"APPROVED\"}");
        MvcTestResult dup = send("POST", del(ci, reel2, "posted"), "{\"liveUrl\": \"" + live + "\", \"postedAt\": \"2026-11-06\"}");
        assertThat((List<String>) read(dup, "$.errors")).containsExactly("That link is already used in this campaign");
        send("POST", del(ci, reel2, "posted"), "{\"liveUrl\": \"https://www.instagram.com/reel/xyz789/\", \"postedAt\": \"2026-11-06\"}");

        // everything posted, not paid: LIVE; that blocks completing and cancelling
        MvcTestResult detail = mvc.get().uri("/api/campaigns/" + ci[0]).exchange();
        assertThat((String) read(detail, "$.members[0].displayStage")).isEqualTo("LIVE");
        assertThat((List<String>) read(send("POST", "/api/campaigns/" + ci[0] + "/status", "{\"action\": \"COMPLETE\"}"), "$.errors"))
                .containsExactly("Name cc_loop: not paid yet");
        assertThat((List<String>) read(send("POST", "/api/campaigns/" + ci[0] + "/status", "{\"action\": \"CANCEL\", \"reason\": \"x\"}"), "$.errors"))
                .containsExactly("Name cc_loop: content is live but unpaid (pay or write off first)");

        // counts on the list card and the profile history
        MvcTestResult list = mvc.get().uri("/api/campaigns").exchange();
        String card = "$[?(@.id == " + ci[0] + ")]";
        assertThat((List<Integer>) read(list, card + ".posted")).containsExactly(2);
        assertThat((List<Integer>) read(list, card + ".unpaid")).containsExactly(1);
        MvcTestResult history = mvc.get().uri("/api/influencers/" + ci[1] + "/campaigns").exchange();
        assertThat((Integer) read(history, "$[0].posted")).isEqualTo(2);
        assertThat((Boolean) read(history, "$[0].removable")).isFalse();
    }

    @Test
    void contentOnRecordCantBeDropped() throws Exception {
        int[] clean = negotiating("cc_back");
        send("POST", terms(clean), "{\"compensation\": \"CASH\", \"feeInr\": 3000, \"stories\": 1}");
        MvcTestResult back = send("PUT", "/api/campaigns/%d/members/%d/stage".formatted(clean[0], clean[1]),
                "{\"stage\": \"NEGOTIATING\", \"reason\": \"Brand changed the brief\"}");
        assertThat(back).hasStatusOk().bodyJson()                                       // no work yet: terms dropped
                .hasPathSatisfying("$.members[0].deliverables", v -> assertThat(v).asArray().isEmpty())
                .hasPathSatisfying("$.members[0].paymentStatus", v -> assertThat(v).isEqualTo("NOT_DUE"));

        int[] worked = negotiating("cc_kept");
        int d = read(send("POST", terms(worked), "{\"compensation\": \"CASH\", \"feeInr\": 3000, \"stories\": 1}"),
                "$.members[0].deliverables[0].id");
        send("POST", del(worked, d, "drafts"), "{\"draftUrl\": \"" + DRIVE + "\"}");
        assertThat(send("PUT", "/api/campaigns/%d/members/%d/stage".formatted(worked[0], worked[1]),
                "{\"stage\": \"NEGOTIATING\", \"reason\": \"x\"}")).hasStatus(HttpStatus.CONFLICT);
        MvcTestResult remove = mvc.delete().uri("/api/campaigns/%d/members/%d".formatted(worked[0], worked[1])).exchange();
        assertThat((List<String>) read(remove, "$.errors")).containsExactly("They have submitted content; it must stay on record");
    }
}
