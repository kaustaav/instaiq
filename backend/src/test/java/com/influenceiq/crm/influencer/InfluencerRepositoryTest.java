package com.influenceiq.crm.influencer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.influenceiq.crm.TestcontainersConfiguration;
import com.influenceiq.crm.common.AuditConfig;
import com.influenceiq.crm.common.CurrentUser;
import com.influenceiq.crm.common.Origin;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Runs against a throwaway Postgres (Testcontainers), with Flyway applying the migrations first.
 * Each test runs in a transaction that is rolled back afterwards.
 */
@DataJpaTest // starts only the JPA part of the app: entities, repositories, Flyway, a transaction per test
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE) // keep the Testcontainers Postgres (not an in-memory DB)
@Import({TestcontainersConfiguration.class, AuditConfig.class, CurrentUser.class}) // throwaway Postgres + auditing (slice tests skip @Configuration)
class InfluencerRepositoryTest {

    @Autowired InfluencerRepository influencers;
    @Autowired InfluencerRateCardRepository rateCards;
    @Autowired JdbcClient jdbc;

    private Influencer priya() {
        return new Influencer(InstagramHandle.parse("https://www.instagram.com/PriyaJewels/"), "Priya Sharma",
                List.of("Chandigarh", "Mohali"), List.of("Chandigarh", "Punjab"), List.of("Jewellery", "Fashion"),
                Metrics.ofFollowers(8400), Origin.MANUAL, "test", null);
    }

    @Test
    void savesAndLoadsWithArraysAuditAndNormalizedHandle() {
        Influencer saved = influencers.saveAndFlush(priya()); // flush = run the INSERT now

        Influencer loaded = influencers.findByHandle(InstagramHandle.parse("@PriyaJewels")).orElseThrow();
        assertThat(loaded.getId()).isEqualTo(saved.getId());
        assertThat(loaded.getHandle().value()).isEqualTo("priyajewels");    // URL + capitals normalized, via the converter
        assertThat(loaded.getCities()).containsExactly("Chandigarh", "Mohali"); // text[] round-trip
        assertThat(loaded.getCreatedBy()).isEqualTo(AuditConfig.SYSTEM_USER);   // filled by auditing
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(loaded.getMetricsSource()).isEqualTo(Origin.MANUAL);
    }

    @Test
    void handleIsUniqueIgnoringCase() {
        influencers.saveAndFlush(priya());
        Influencer duplicate = new Influencer(InstagramHandle.parse("@PRIYAJEWELS"), "Someone Else", List.of("Delhi"), List.of("Delhi"),
                List.of("Food"), Metrics.ofFollowers(1000), Origin.MANUAL, "test", null);

        assertThatThrownBy(() -> influencers.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class); // influencer_handle_uq
    }

    @Test
    void metricsTimestampOnlyMovesWhenNumbersChange() throws InterruptedException {
        Influencer i = influencers.saveAndFlush(priya());
        var first = i.getMetricsUpdatedAt();

        Thread.sleep(5);
        i.updateMetrics(Metrics.ofFollowers(8400), Origin.MANUAL, "test", null); // same numbers
        assertThat(i.getMetricsUpdatedAt()).isEqualTo(first);

        i.updateMetrics(new Metrics(9000, new BigDecimal("6.2"), 521, 43), Origin.MANUAL, "test", null); // changed
        var second = i.getMetricsUpdatedAt();
        assertThat(second).isAfter(first);

        Thread.sleep(5);
        // 6.2 vs 6.20: same number, different BigDecimal scale; must NOT count as a change
        i.updateMetrics(new Metrics(9000, new BigDecimal("6.20"), 521, 43), Origin.MANUAL, "test", null);
        assertThat(i.getMetricsUpdatedAt()).isEqualTo(second);
    }

    @Test
    void fullTextSearchColumnIsMaintainedByPostgres() {
        influencers.saveAndFlush(priya());
        // search_vector isn't mapped in Java; Postgres computes it. Query it with plain SQL via JdbcClient.
        List<String> hits = jdbc.sql("""
                        SELECT handle FROM influencer
                        WHERE search_vector @@ websearch_to_tsquery('simple', :q)""")
                .param("q", "priya")
                .query(String.class)
                .list();
        assertThat(hits).contains("priyajewels");
    }

    @Test
    void currentRateCardIsTheNewest() {
        Influencer i = influencers.saveAndFlush(priya());
        rateCards.saveAndFlush(new InfluencerRateCard(i, 1500, 4000, 2800, Origin.MANUAL, null));
        rateCards.saveAndFlush(new InfluencerRateCard(i, 2000, 5000, 3500, Origin.MANUAL, null));

        InfluencerRateCard current = rateCards.findFirstByInfluencerIdOrderByEffectiveFromDesc(i.getId()).orElseThrow();
        assertThat(current.getReelInr()).isEqualTo(5000);
        assertThat(rateCards.findByInfluencerIdOrderByEffectiveFromDesc(i.getId())).hasSize(2);
    }

    @Test
    void rejectsInvalidInput() {
        InstagramHandle ok = new InstagramHandle("ok_handle");
        assertThatThrownBy(() -> new Influencer(ok, "X", List.of(), List.of(), List.of("Food"), Metrics.ofFollowers(100), Origin.MANUAL, "t", null))
                .hasMessageContaining("city or state");
        assertThatThrownBy(() -> Metrics.ofFollowers(0))
                .hasMessageContaining("Followers");
    }

    @Test
    void listGettersAreReadOnly() {
        Influencer i = priya();
        assertThatThrownBy(() -> i.getCities().add("Delhi")).isInstanceOf(UnsupportedOperationException.class);
    }
}
