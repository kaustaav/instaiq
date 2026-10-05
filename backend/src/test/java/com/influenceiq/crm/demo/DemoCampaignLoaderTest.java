package com.influenceiq.crm.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.influenceiq.crm.TestcontainersConfiguration;
import com.influenceiq.crm.campaign.api.CampaignQueryService;
import com.influenceiq.crm.campaign.api.CampaignSummary;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * The demo campaigns replay through the real rules; if a rule change makes the demo data invalid, this fails
 * (instead of the loader quietly loading fewer campaigns).
 */
@SpringBootTest(properties = "app.demo-data.enabled=true")
@Import(TestcontainersConfiguration.class)
class DemoCampaignLoaderTest {

    @Autowired CampaignQueryService campaigns;
    @Autowired DemoCampaignLoader loader;

    @Test
    void allDemoCampaignsLoadInTheirFinalState() throws Exception {
        Map<String, CampaignSummary> byName = campaigns.list().stream()
                .collect(Collectors.toMap(CampaignSummary::name, c -> c));
        assertThat(byName).hasSize(6);
        assertThat(byName.get("Diwali Bridal Push").status().name()).isEqualTo("ACTIVE");
        assertThat(byName.get("Diwali Bridal Push").memberCount()).isEqualTo(8);
        assertThat(byName.get("Diwali Bridal Push").posted()).isEqualTo(3);
        assertThat(byName.get("Bridal Jewellery Q2 2025").status().name()).isEqualTo("COMPLETED");
        assertThat(byName.get("Summer Travel Diaries 2025").status().name()).isEqualTo("ARCHIVED");
        assertThat(byName.get("Monsoon Beauty Edit").status().name()).isEqualTo("CANCELLED");

        loader.load(); // second run: recognises the demo set and adds nothing
        assertThat(campaigns.list()).hasSize(6);
    }
}
