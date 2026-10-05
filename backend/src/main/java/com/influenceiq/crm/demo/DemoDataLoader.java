package com.influenceiq.crm.demo;

import com.influenceiq.crm.common.Origin;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.InfluencerRepository;
import com.influenceiq.crm.ingestion.DuplicateInfluencerException;
import com.influenceiq.crm.ingestion.InfluencerIngestionService;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Loads 500 fictional influencers (src/main/resources/demo/influencers.json) into an empty database, then the
 * demo campaigns (DemoCampaignLoader) if they aren't there yet.
 * <p>
 * Off by default. Turned on locally with DEMO_DATA=true in .env; never on a real deployment, which is why this
 * is a loader and not a Flyway migration (migrations run on every database, including production).
 * Every profile goes through the Ingestion Service, so demo data obeys the same rules as real data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true") // bean only exists when switched on
class DemoDataLoader implements ApplicationRunner { // ApplicationRunner = runs once, after the app has started

    static final String ACTOR = "demo-loader";

    private final InfluencerRepository influencers;
    private final InfluencerIngestionService ingestion;
    private final JsonMapper json;
    private final DemoCampaignLoader campaigns;

    @Override
    public void run(ApplicationArguments args) throws IOException {
        loadInfluencers();
        campaigns.load();
    }

    private void loadInfluencers() throws IOException {
        if (influencers.count() > 0) {
            log.info("Demo data: skipped, {} influencers already exist", influencers.count());
            return;
        }
        List<DemoInfluencer> rows;
        try (InputStream in = new ClassPathResource("demo/influencers.json").getInputStream()) {
            rows = json.readValue(in, new TypeReference<>() {});
        }
        Instant now = Instant.now();
        int loaded = 0;
        int failed = 0;
        for (DemoInfluencer row : rows) {
            try {
                // each create() is its own transaction, so one bad row doesn't undo the others
                ingestion.create(row.toInput(now), Origin.MANUAL, ACTOR);
                loaded++;
            } catch (ValidationException | DuplicateInfluencerException e) {
                failed++;
                log.warn("Demo data: skipped {}: {}", row.handle(), e.getMessage());
            }
        }
        log.info("Demo data: loaded {} influencers ({} skipped) in {} ms", loaded, failed,
                ChronoUnit.MILLIS.between(now, Instant.now()));
    }
}
