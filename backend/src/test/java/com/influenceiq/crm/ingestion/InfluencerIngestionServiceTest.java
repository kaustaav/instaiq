package com.influenceiq.crm.ingestion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.influenceiq.crm.TestcontainersConfiguration;
import com.influenceiq.crm.common.AuditConfig;
import com.influenceiq.crm.common.CurrentUser;
import com.influenceiq.crm.common.Origin;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRateCardRepository;
import com.influenceiq.crm.reference.ReferenceDataService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

/** The ingestion rules, against a throwaway Postgres (Testcontainers), rolled back after each test. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, AuditConfig.class, CurrentUser.class, InfluencerIngestionService.class, ReferenceDataService.class})
class InfluencerIngestionServiceTest {

    @Autowired InfluencerIngestionService ingestion;
    @Autowired InfluencerRateCardRepository rateCards;

    /** A valid input; tests override what they need. Messy casing on purpose. */
    private static InfluencerInput input(String handle, List<String> cities, List<String> stateOnly, List<String> categories) {
        return new InfluencerInput(handle, "Priya Sharma", " Bridal jewellery ", "", null, null,
                cities, stateOnly, categories, List.of("hindi", "Punjabi"), List.of("#BridalJewellery", "bridaljewellery", "#Kundan"),
                8400, new BigDecimal("6.2"), 521, 43, 2000, 5000, null, null,
                Instant.now().minus(12, ChronoUnit.DAYS), null);
    }

    @Test
    void createsWithCanonicalValuesDerivedStatesAndRateCard() {
        Influencer i = ingestion.create(
                input("@PriyaJewels", List.of("chandigarh", "MOHALI"), List.of(), List.of("jewellery")), Origin.MANUAL, "test");

        assertThat(i.getHandle().value()).isEqualTo("priyajewels");
        assertThat(i.getCities()).containsExactly("Chandigarh", "Mohali");      // canonical spelling
        assertThat(i.getStates()).containsExactly("Chandigarh", "Punjab");      // derived from the cities
        assertThat(i.getCategories()).containsExactly("Jewellery");
        assertThat(i.getLanguages()).containsExactly("Hindi", "Punjabi");
        assertThat(i.getHashtags()).containsExactly("bridaljewellery", "kundan"); // normalized + de-duplicated
        assertThat(i.getBio()).isEqualTo("Bridal jewellery");                    // trimmed
        assertThat(i.getEmail()).isNull();                                       // blank -> null
        assertThat(i.getMetricsUpdatedAt()).isBefore(Instant.now().minus(11, ChronoUnit.DAYS)); // observedAt kept

        var card = rateCards.findFirstByInfluencerIdOrderByEffectiveFromDesc(i.getId()).orElseThrow();
        assertThat(card.getReelInr()).isEqualTo(5000);
        assertThat(card.getPostInr()).isNull(); // not shared
    }

    @Test
    void stateOnlyEntriesAreKept() {
        Influencer i = ingestion.create(input("jasleen_kitchen", List.of(), List.of("punjab"), List.of("Food")), Origin.MANUAL, "t");
        assertThat(i.getCities()).isEmpty();
        assertThat(i.getStates()).containsExactly("Punjab");
    }

    @Test
    void reportsAllUnknownValuesAtOnce() {
        assertThatThrownBy(() -> ingestion.create(
                input("someone", List.of("Atlantis"), List.of("Narnia"), List.of("Jewellery", "Underwater basket weaving")),
                Origin.MANUAL, "t"))
                .isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getErrors()).containsExactly(
                        "Unknown city: Atlantis", "Unknown state: Narnia", "Unknown category: Underwater basket weaving"));
    }

    @Test
    void duplicateHandleIsRejectedWithTheExistingId() {
        Influencer first = ingestion.create(input("priyajewels", List.of("Chandigarh"), List.of(), List.of("Jewellery")), Origin.MANUAL, "t");

        assertThatThrownBy(() -> ingestion.create(
                input("https://instagram.com/PRIYAJEWELS", List.of("Delhi"), List.of(), List.of("Food")), Origin.MANUAL, "t"))
                .isInstanceOfSatisfying(DuplicateInfluencerException.class,
                        e -> assertThat(e.getExistingId()).isEqualTo(first.getId()));
    }

    @Test
    void entityRulesSurfaceAsValidationErrors() {
        assertThatThrownBy(() -> ingestion.create(input("bad handle!", List.of("Delhi"), List.of(), List.of("Food")), Origin.MANUAL, "t"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("Not a valid Instagram handle");
        assertThatThrownBy(() -> ingestion.create(input("ok", List.of(), List.of(), List.of("Food")), Origin.MANUAL, "t"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("city or state");
    }
}
