package com.influenceiq.crm.ingestion;

import com.influenceiq.crm.common.Origin;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRateCard;
import com.influenceiq.crm.influencer.InfluencerRateCardRepository;
import com.influenceiq.crm.influencer.InfluencerRepository;
import com.influenceiq.crm.influencer.InstagramHandle;
import com.influenceiq.crm.influencer.Metrics;
import com.influenceiq.crm.reference.ReferenceData;
import com.influenceiq.crm.reference.ReferenceDataService;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single entry point for creating influencers (CLAUDE.md: "all influencer writes go through an Ingestion
 * Service"). The add form, Excel import, demo loader and a future scraper all call this, so the rules live once:
 * handle normalization, no duplicates, known cities/categories/languages, states derived from cities.
 */
@Service
@RequiredArgsConstructor
public class InfluencerIngestionService {

    private final InfluencerRepository influencers;
    private final InfluencerRateCardRepository rateCards;
    private final ReferenceDataService referenceData;

    /**
     * Validates, normalizes and saves one influencer (plus its first rate card if any price is given).
     *
     * @throws ValidationException           input breaks a rule (all problems listed at once)
     * @throws DuplicateInfluencerException the handle already exists
     */
    @Transactional // influencer + rate card are saved together, or neither is
    public Influencer create(InfluencerInput in, Origin origin, String actor) {
        InstagramHandle handle = parseHandle(in.handle());
        influencers.findByHandle(handle).ifPresent(existing -> {
            throw new DuplicateInfluencerException(handle, existing.getId());
        });

        ReferenceData ref = referenceData.get();
        List<String> errors = new ArrayList<>();
        List<String> cities = canonical(in.cities(), ref::city, "Unknown city", errors);
        List<String> stateOnly = canonical(in.stateOnly(), ref::state, "Unknown state", errors);
        List<String> categories = canonical(in.categories(), ref::category, "Unknown category", errors);
        List<String> languages = canonical(in.languages(), ref::language, "Unknown language", errors);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors); // report every problem at once, not one per attempt
        }

        // states column = the cities' states + state-only entries (so a "Punjab" filter finds Mohali too)
        Set<String> states = new LinkedHashSet<>();
        cities.forEach(c -> ref.stateOfCity(c).ifPresent(states::add));
        states.addAll(stateOnly);

        try {
            Metrics metrics = new Metrics(in.followers(), in.engagementRate(), in.avgLikes(), in.avgComments());
            Influencer influencer = new Influencer(handle, in.name(), cities, List.copyOf(states), categories,
                    metrics, origin, actor, in.metricsObservedAt());
            influencer.updateDetails(in.bio(), in.email(), in.phone(), in.discoverySource());
            influencer.setLanguages(languages);
            influencer.setHashtags(in.hashtags());
            if (in.notes() != null && !in.notes().isBlank()) {
                influencer.updateNotes(in.notes(), actor);
            }
            influencers.save(influencer);

            if (in.storyInr() != null || in.reelInr() != null || in.postInr() != null) {
                rateCards.save(new InfluencerRateCard(influencer, in.storyInr(), in.reelInr(), in.postInr(),
                        origin, in.ratesEffectiveFrom()));
            }
            return influencer;
        } catch (IllegalArgumentException e) { // rule broken inside an entity / value object
            throw new ValidationException(e.getMessage());
        }
    }

    private static InstagramHandle parseHandle(String raw) {
        try {
            return InstagramHandle.parse(raw);
        } catch (IllegalArgumentException e) {
            throw new ValidationException(e.getMessage());
        }
    }

    /** Maps each value to its canonical spelling; unknown values are collected as errors. */
    private static List<String> canonical(List<String> raw, Function<String, Optional<String>> lookup,
                                          String label, List<String> errors) {
        List<String> out = new ArrayList<>();
        for (String v : raw == null ? List.<String>of() : raw) {
            lookup.apply(v).ifPresentOrElse(
                    c -> { if (!out.contains(c)) out.add(c); },
                    () -> errors.add(label + ": " + v));
        }
        return out;
    }
}
