package com.influenceiq.crm.influencer;

import com.influenceiq.crm.common.Auditable;
import com.influenceiq.crm.common.Origin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * An Instagram influencer (table "influencer", created by V2__influencers.sql).
 * <p>
 * No public setters: changes go through methods that keep the rules (metrics freshness, status needs a reason).
 * Lombok generates the getters; list getters are hand-written to return read-only copies, so callers can't
 * modify the lists behind the validation in setLocation/setCategories. The search_vector column is computed
 * by Postgres and isn't mapped here.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED) // JPA needs a no-arg constructor to load rows; not for app code
@Entity
@Table(name = "influencer")
public class Influencer extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // the database assigns the id (GENERATED ALWAYS AS IDENTITY)
    private Long id;

    @Column(name = "handle", nullable = false, columnDefinition = "citext") // stored via InstagramHandleConverter
    private InstagramHandle handle;

    @Column(nullable = false)
    private String name;

    private String bio;
    private String email;
    private String phone;

    @Enumerated(EnumType.STRING) // store "REFERRAL", not 1, so reordering the enum can't corrupt data
    @Column(name = "discovery_source", nullable = false)
    private DiscoverySource discoverySource = DiscoverySource.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InfluencerStatus status = InfluencerStatus.ACTIVE;

    @Column(name = "status_reason")
    private String statusReason;
    @Column(name = "status_changed_at")
    private Instant statusChangedAt;
    @Column(name = "status_changed_by")
    private String statusChangedBy;

    // Postgres text[] columns, mapped as Java lists
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> cities = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> states = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> categories = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> languages = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> hashtags = new ArrayList<>();

    @Column(nullable = false)
    private int followers;

    @Column(name = "engagement_rate", precision = 5, scale = 2)
    private BigDecimal engagementRate;

    @Column(name = "avg_likes")
    private Integer avgLikes;

    @Column(name = "avg_comments")
    private Integer avgComments;

    @Column(name = "metrics_updated_at", nullable = false)
    private Instant metricsUpdatedAt;
    @Column(name = "metrics_updated_by", nullable = false)
    private String metricsUpdatedBy;
    @Enumerated(EnumType.STRING)
    @Column(name = "metrics_source", nullable = false)
    private Origin metricsSource = Origin.MANUAL;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "recent_captions", nullable = false)
    private List<String> recentCaptions = new ArrayList<>();
    @Column(name = "captions_updated_at")
    private Instant captionsUpdatedAt;
    @Column(name = "captions_updated_by")
    private String captionsUpdatedBy;
    @Enumerated(EnumType.STRING)
    @Column(name = "captions_source")
    private Origin captionsSource;

    private String notes;
    @Column(name = "notes_updated_at")
    private Instant notesUpdatedAt;
    @Column(name = "notes_updated_by")
    private String notesUpdatedBy;

    /**
     * A new influencer with the fields the add form requires.
     *
     * @param observedAt when the metrics were true (usually now; a scraper or an import may know an earlier time)
     */
    public Influencer(InstagramHandle handle, String name, List<String> cities, List<String> states,
                      List<String> categories, Metrics metrics, Origin origin, String actor, Instant observedAt) {
        this.handle = Objects.requireNonNull(handle, "handle");
        this.name = requireText(name, "name");
        setLocation(cities, states);
        setCategories(categories);
        updateMetrics(metrics, origin, actor, observedAt);
    }

    /** Optional profile details; blank values are stored as null. */
    public void updateDetails(String bio, String email, String phone, DiscoverySource discoverySource) {
        this.bio = blankToNull(bio);
        this.email = blankToNull(email);
        this.phone = blankToNull(phone);
        this.discoverySource = discoverySource == null ? DiscoverySource.OTHER : discoverySource;
    }

    public void setLanguages(List<String> languages) {
        this.languages = new ArrayList<>(languages == null ? List.of() : languages);
    }

    /** "#BridalJewellery" and "bridaljewellery" are the same tag: stored lowercase, without "#", no duplicates. */
    public void setHashtags(List<String> hashtags) {
        this.hashtags = new ArrayList<>((hashtags == null ? List.<String>of() : hashtags).stream()
                .map(t -> t.trim().replaceFirst("^#", "").toLowerCase(Locale.ROOT))
                .filter(t -> !t.isEmpty())
                .distinct()
                .toList());
    }

    public void updateNotes(String notes, String actor) {
        this.notes = blankToNull(notes);
        this.notesUpdatedAt = Instant.now();
        this.notesUpdatedBy = actor;
    }

    /** At least one city or state; the states list also includes the cities' states (kept in sync by the caller). */
    public void setLocation(List<String> cities, List<String> states) {
        List<String> c = cities == null ? List.of() : cities;
        List<String> s = states == null ? List.of() : states;
        if (c.isEmpty() && s.isEmpty()) {
            throw new IllegalArgumentException("Add at least one city or state");
        }
        this.cities = new ArrayList<>(c);
        this.states = new ArrayList<>(s);
    }

    public void setCategories(List<String> categories) {
        if (categories == null || categories.isEmpty()) {
            throw new IllegalArgumentException("Pick at least one category");
        }
        this.categories = new ArrayList<>(categories);
    }

    /**
     * Freshness rule: metrics_updated_* change only when a number actually changes (or on create).
     * Re-saving the same numbers keeps the old timestamp, so "updated 3 days ago" stays truthful.
     */
    public void updateMetrics(Metrics metrics, Origin origin, String actor, Instant observedAt) {
        Objects.requireNonNull(metrics, "metrics");
        if (metricsUpdatedAt != null && metrics.equals(getMetrics())) {
            return; // same numbers: keep the old timestamp
        }
        this.followers = metrics.followers();
        this.engagementRate = metrics.engagementRate();
        this.avgLikes = metrics.avgLikes();
        this.avgComments = metrics.avgComments();
        this.metricsUpdatedAt = observedAt == null ? Instant.now() : observedAt;
        this.metricsUpdatedBy = actor;
        this.metricsSource = Objects.requireNonNull(origin, "origin");
    }

    /** The current numbers as one value (the columns are stored flat). */
    public Metrics getMetrics() {
        return new Metrics(followers, engagementRate, avgLikes, avgComments);
    }

    /** Anything other than ACTIVE needs a reason ("why was this person banned?" must have an answer). */
    public void changeStatus(InfluencerStatus newStatus, String reason, String actor) {
        if (newStatus != InfluencerStatus.ACTIVE && (reason == null || reason.isBlank())) {
            throw new IllegalArgumentException("A reason is required for status " + newStatus);
        }
        this.status = newStatus;
        this.statusReason = newStatus == InfluencerStatus.ACTIVE ? null : reason.trim();
        this.statusChangedAt = Instant.now();
        this.statusChangedBy = actor;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static String requireText(String v, String field) {
        if (v == null || v.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return v.trim();
    }

    // Read-only copies (see class comment); Lombok won't generate getters that already exist.
    public List<String> getCities() { return List.copyOf(cities); }
    public List<String> getStates() { return List.copyOf(states); }
    public List<String> getCategories() { return List.copyOf(categories); }
    public List<String> getLanguages() { return List.copyOf(languages); }
    public List<String> getHashtags() { return List.copyOf(hashtags); }
    public List<String> getRecentCaptions() { return List.copyOf(recentCaptions); }
}
