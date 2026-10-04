package com.influenceiq.crm.ingestion;

import com.influenceiq.crm.common.ConflictException;
import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.common.Origin;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRateCard;
import com.influenceiq.crm.influencer.InfluencerRateCardRepository;
import com.influenceiq.crm.influencer.InfluencerRepository;
import com.influenceiq.crm.influencer.InfluencerStatus;
import com.influenceiq.crm.influencer.InstagramHandle;
import com.influenceiq.crm.influencer.Metrics;
import com.influenceiq.crm.reference.ReferenceData;
import com.influenceiq.crm.reference.ReferenceDataService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
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
    private final EntityManager entityManager;

    /**
     * Validates, normalizes and saves one influencer (plus its first rate card if any price is given).
     *
     * @throws ValidationException           input breaks a rule (all problems listed at once)
     * @throws DuplicateInfluencerException the handle already exists
     */
    @Transactional // influencer + rate card are saved together, or neither is
    public Influencer create(InfluencerInput in, Origin origin, String actor) {
        Validated v = validate(in);
        influencers.findByHandle(v.handle()).ifPresent(existing -> {
            throw new DuplicateInfluencerException(v.handle(), existing.getId());
        });
        return asValidationErrors(() -> {
            Influencer influencer = new Influencer(v.handle(), in.name(), v.cities(), v.states(), v.categories(),
                    metricsOf(in), origin, actor, in.metricsObservedAt());
            applyDetails(influencer, in, v);
            if (in.notes() != null && !in.notes().isBlank()) {
                influencer.updateNotes(in.notes(), actor);
            }
            influencers.save(influencer);
            addRateCardIfChanged(influencer, in, origin);
            return influencer;
        });
    }

    /**
     * Edits an influencer. Same validation as create, plus:
     * <ul>
     *   <li>optimistic locking: {@code expectedVersion} must match, or someone else saved in between (409);</li>
     *   <li>freshness: the metrics date only moves if a number changed (Influencer.updateMetrics);</li>
     *   <li>rate history: changed prices add a new rate card; old ones are never overwritten.</li>
     * </ul>
     * Notes and status have their own methods (different screens, different rules).
     */
    @Transactional
    public Influencer update(long id, int expectedVersion, InfluencerInput in, Origin origin, String actor) {
        Influencer influencer = influencers.findById(id).orElseThrow(() -> new NotFoundException("Influencer", id));
        if (influencer.getVersion() != expectedVersion) {
            throw new ConflictException("This influencer was changed by someone else. Reload and try again.");
        }
        Validated v = validate(in);
        influencers.findByHandle(v.handle())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> { throw new DuplicateInfluencerException(v.handle(), other.getId()); });
        return asValidationErrors(() -> {
            influencer.changeHandle(v.handle());
            influencer.rename(in.name());
            influencer.setLocation(v.cities(), v.states());
            influencer.setCategories(v.categories());
            influencer.updateMetrics(metricsOf(in), origin, actor, in.metricsObservedAt());
            applyDetails(influencer, in, v);
            if (addRateCardIfChanged(influencer, in, origin)) {
                // Rate cards are separate rows, so a price-only edit leaves the influencer row untouched and JPA
                // wouldn't bump its @Version. Force it: prices are part of the profile, and two people changing
                // them at once must get the same 409 as any other conflicting edit.
                // (If other fields changed too, the version moves by 2. Harmless: clients only compare it.)
                entityManager.lock(influencer, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
            }
            return influencer; // no save() needed: changes to a loaded entity are written at commit ("dirty checking")
        });
    }

    @Transactional
    public Influencer updateNotes(long id, String notes, String actor) {
        Influencer influencer = influencers.findById(id).orElseThrow(() -> new NotFoundException("Influencer", id));
        influencer.updateNotes(notes, actor);
        return influencer;
    }

    @Transactional
    public Influencer changeStatus(long id, InfluencerStatus status, String reason, String actor) {
        if (status == null) {
            throw new ValidationException("status is required");
        }
        Influencer influencer = influencers.findById(id).orElseThrow(() -> new NotFoundException("Influencer", id));
        return asValidationErrors(() -> {
            influencer.changeStatus(status, reason, actor);
            return influencer;
        });
    }

    // ---------- shared by create and update ----------

    /** Input after normalization and reference-data checks. */
    private record Validated(InstagramHandle handle, List<String> cities, List<String> states,
                             List<String> categories, List<String> languages) {}

    private Validated validate(InfluencerInput in) {
        InstagramHandle handle = parseHandle(in.handle());
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
        return new Validated(handle, cities, List.copyOf(states), categories, languages);
    }

    private static Metrics metricsOf(InfluencerInput in) {
        return new Metrics(in.followers(), in.engagementRate(), in.avgLikes(), in.avgComments());
    }

    private static void applyDetails(Influencer influencer, InfluencerInput in, Validated v) {
        influencer.updateDetails(in.bio(), in.email(), in.phone(), in.discoverySource());
        influencer.setLanguages(v.languages());
        influencer.setHashtags(in.hashtags());
    }

    /**
     * Rate history: a new card only when prices differ from the current one. Nothing is ever overwritten.
     * @return whether a card was added
     */
    private boolean addRateCardIfChanged(Influencer influencer, InfluencerInput in, Origin origin) {
        Optional<InfluencerRateCard> current = influencer.getId() == null ? Optional.empty()
                : rateCards.findFirstByInfluencerIdOrderByEffectiveFromDesc(influencer.getId());
        boolean anyPrice = in.storyInr() != null || in.reelInr() != null || in.postInr() != null;
        boolean changed = current
                .map(c -> !Objects.equals(c.getStoryInr(), in.storyInr()) || !Objects.equals(c.getReelInr(), in.reelInr())
                        || !Objects.equals(c.getPostInr(), in.postInr()))
                .orElse(anyPrice);
        if (changed) {
            rateCards.save(new InfluencerRateCard(influencer, in.storyInr(), in.reelInr(), in.postInr(),
                    origin, in.ratesEffectiveFrom()));
        }
        return changed;
    }

    /** Rules broken inside an entity or value object surface as IllegalArgumentException; report them as 400s. */
    private static <T> T asValidationErrors(Supplier<T> action) {
        try {
            return action.get();
        } catch (IllegalArgumentException e) {
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
