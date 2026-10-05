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

/** Payments, fee changes and write-offs (campaigns step 4). Demo data off. */
@SpringBootTest(properties = "app.demo-data.enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CampaignPaymentApiTest {

    private static final String RECEIPT = "https://drive.google.com/file/d/receipt/view";

    @Autowired MockMvcTester mvc;

    private MvcTestResult send(String method, String uri, String json) {
        var req = method.equals("POST") ? mvc.post().uri(uri) : mvc.put().uri(uri);
        return req.contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private static <T> T read(MvcTestResult r, String path) throws UnsupportedEncodingException {
        return JsonPath.read(r.getResponse().getContentAsString(), path);
    }

    /** An active campaign with one member who agreed `termsJson`, with all content posted when `post` is true. */
    private int[] agreed(String handle, String termsJson, boolean post) throws Exception {
        int inf = read(send("POST", "/api/influencers", """
                {"handle": "%s", "name": "Name %s", "cities": ["Pune"], "categories": ["Food"], "followers": 4000}"""
                .formatted(handle, handle)), "$.id");
        int id = read(send("POST", "/api/campaigns", """
                {"name": "Pay", "brand": "Acme Tea", "targetInfluencers": 1, "startDate": "2026-11-01", "endDate": "2026-11-30"}"""),
                "$.id");
        String m = "/api/campaigns/%d/members/%d".formatted(id, inf);
        send("POST", "/api/campaigns/" + id + "/members", "{\"influencerIds\": [%d]}".formatted(inf));
        send("PUT", m + "/stage", "{\"stage\": \"CONTACTED\"}");
        send("PUT", m + "/stage", "{\"stage\": \"NEGOTIATING\"}");
        MvcTestResult r = send("POST", m + "/terms", termsJson);
        send("POST", "/api/campaigns/" + id + "/status", "{\"action\": \"ACTIVATE\"}");
        if (post) {
            List<Integer> ids = read(r, "$.members[0].deliverables[*].id");
            for (int d : ids) {
                send("POST", m + "/deliverables/" + d + "/drafts", "{\"draftUrl\": \"https://drive.google.com/d" + d + "\"}");
                send("POST", m + "/deliverables/" + d + "/review", "{\"decision\": \"APPROVED\"}");
                send("POST", m + "/deliverables/" + d + "/posted",
                        "{\"liveUrl\": \"https://www.instagram.com/reel/" + handle + d + "/\", \"postedAt\": \"2026-11-05\"}");
            }
        }
        return new int[] {id, inf};
    }

    private String member(int[] ci) {
        return "/api/campaigns/%d/members/%d".formatted(ci[0], ci[1]);
    }

    private MvcTestResult pay(int[] ci, String amountAndDate) {
        return send("POST", member(ci) + "/payments", "{%s, \"receiptUrl\": \"%s\"}".formatted(amountAndDate, RECEIPT));
    }

    @Test
    void paymentsFeeChangeAndCompletion() throws Exception {
        int[] ci = agreed("pay_cash", "{\"compensation\": \"CASH\", \"feeInr\": 10000, \"reels\": 1}", true);
        assertThat((String) read(mvc.get().uri("/api/campaigns/" + ci[0]).exchange(), "$.members[0].displayStage")).isEqualTo("LIVE");

        MvcTestResult bad = send("POST", member(ci) + "/payments", "{\"amountInr\": 0, \"receiptUrl\": \"receipt.pdf\"}");
        assertThat((List<String>) read(bad, "$.errors")).containsExactly(
                "Amount must be more than 0", "Enter the payment date", "Add a link to the payment receipt (https://…)");

        MvcTestResult advance = pay(ci, "\"amountInr\": 4000, \"paidAt\": \"2026-11-01\"");
        assertThat(advance).bodyJson()
                .hasPathSatisfying("$.members[0].paymentStatus", v -> assertThat(v).isEqualTo("PARTIALLY_PAID"))
                .hasPathSatisfying("$.members[0].amountPaidInr", v -> assertThat(v).isEqualTo(4000))
                .hasPathSatisfying("$.members[0].payments[0].receiptUrl", v -> assertThat(v).isEqualTo(RECEIPT));
        assertThat((List<String>) read(mvc.delete().uri(member(ci)).exchange(), "$.errors"))
                .containsExactly("They have been paid; decline them instead");

        // fee change needs a reason; status follows the new fee
        assertThat(send("PUT", member(ci) + "/fee", "{\"feeInr\": 8000}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(send("PUT", member(ci) + "/fee", "{\"feeInr\": 8000, \"reason\": \"One reel dropped\"}")).bodyJson()
                .hasPathSatisfying("$.members[0].agreedFeeInr", v -> assertThat(v).isEqualTo(8000))
                .hasPathSatisfying("$.members[0].stageReason", v -> assertThat(v).isEqualTo("Fee changed: One reel dropped"))
                .hasPathSatisfying("$.budgetUsedInr", v -> assertThat(v).isEqualTo(8000));

        assertThat(pay(ci, "\"amountInr\": 4000, \"paidAt\": \"2026-11-10\"")).bodyJson()
                .hasPathSatisfying("$.members[0].paymentStatus", v -> assertThat(v).isEqualTo("PAID"))
                .hasPathSatisfying("$.members[0].displayStage", v -> assertThat(v).isEqualTo("COMPLETED"));
        assertThat((List<String>) read(pay(ci, "\"amountInr\": 1, \"paidAt\": \"2026-11-11\""), "$.errors"))
                .containsExactly("Nothing left to pay");

        assertThat(send("POST", "/api/campaigns/" + ci[0] + "/status", "{\"action\": \"COMPLETE\"}")).bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("COMPLETED"));
    }

    @Test
    void writeOffWithNothingPaidBecomesBarter() throws Exception {
        int[] ci = agreed("pay_writeoff", "{\"compensation\": \"CASH\", \"feeInr\": 5000, \"stories\": 1}", true);
        assertThat(send("POST", member(ci) + "/payments/write-off", "{}")).hasStatus(HttpStatus.BAD_REQUEST); // reason
        assertThat(send("POST", member(ci) + "/payments/write-off", "{\"reason\": \"Agreed to settle with product\"}")).bodyJson()
                .hasPathSatisfying("$.members[0].paymentStatus", v -> assertThat(v).isEqualTo("WAIVED"))
                .hasPathSatisfying("$.members[0].compensation", v -> assertThat(v).isEqualTo("BARTER"))
                .hasPathSatisfying("$.members[0].agreedFeeInr", v -> assertThat(v).isNull())
                .hasPathSatisfying("$.budgetUsedInr", v -> assertThat(v).isEqualTo(0)) // nothing will be spent
                .hasPathSatisfying("$.members[0].paymentWriteOffReason", v -> assertThat(v).isEqualTo("Agreed to settle with product"))
                .hasPathSatisfying("$.members[0].displayStage", v -> assertThat(v).isEqualTo("COMPLETED"));
        assertThat((List<String>) read(send("POST", member(ci) + "/payments/write-off", "{\"reason\": \"again\"}"), "$.errors"))
                .containsExactly("Nothing is outstanding");
    }

    @Test
    void writeOffAfterAnAdvanceBecomesPaidPlusProduct() throws Exception {
        int[] ci = agreed("pay_partial", "{\"compensation\": \"CASH\", \"feeInr\": 10000, \"reels\": 1}", true);
        pay(ci, "\"amountInr\": 4000, \"paidAt\": \"2026-11-01\"");
        assertThat(send("POST", member(ci) + "/payments/write-off", "{\"reason\": \"Rest settled with product\"}")).bodyJson()
                .hasPathSatisfying("$.members[0].compensation", v -> assertThat(v).isEqualTo("CASH_AND_PRODUCT"))
                .hasPathSatisfying("$.members[0].agreedFeeInr", v -> assertThat(v).isEqualTo(4000)) // what was paid
                .hasPathSatisfying("$.budgetUsedInr", v -> assertThat(v).isEqualTo(4000))
                .hasPathSatisfying("$.members[0].displayStage", v -> assertThat(v).isEqualTo("COMPLETED"));
        assertThat((List<String>) read(send("PUT", member(ci) + "/fee", "{\"feeInr\": 9000, \"reason\": \"x\"}"), "$.errors"))
                .containsExactly("The payment was written off; the fee is settled");
    }

    @Test
    void barterAndNotYetAgreedCantBePaid() throws Exception {
        int[] barter = agreed("pay_barter", "{\"compensation\": \"BARTER\", \"posts\": 1}", false);
        assertThat((List<String>) read(pay(barter, "\"amountInr\": 100, \"paidAt\": \"2026-11-01\""), "$.errors"))
                .containsExactly("Barter collaborations have no cash payment");
        assertThat((List<String>) read(send("PUT", member(barter) + "/fee", "{\"feeInr\": 100, \"reason\": \"x\"}"), "$.errors"))
                .containsExactly("Fee can be changed only on agreed, paid collaborations");

        int[] early = agreed("pay_early", "{}", false); // terms rejected: still negotiating
        assertThat((List<String>) read(pay(early, "\"amountInr\": 100, \"paidAt\": \"2026-11-01\""), "$.errors"))
                .containsExactly("Payments are recorded after terms are agreed");
    }
}
