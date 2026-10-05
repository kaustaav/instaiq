package com.influenceiq.crm.reference;

import com.influenceiq.crm.common.ValidationException;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Keeps the reference lists (geo_city, taxonomy) in memory. They're tiny (~200 rows) and change rarely,
 * so validation never queries them per request. Call {@link #refresh()} after adding a custom value.
 * <p>
 * Plain SQL via JdbcClient: read-only lookups don't need entities.
 */
@Slf4j // Lombok: adds a "log" field (SLF4J logger)
@Service
@RequiredArgsConstructor // Lombok: constructor for the final fields, which Spring uses for dependency injection
public class ReferenceDataService {

    private final JdbcClient jdbc;

    /** The two lists in the taxonomy table. `label` is how the UI calls it, for error messages. */
    public enum TaxonomyType {
        CATEGORY("Niche"), LANGUAGE("Language");

        private final String label;

        TaxonomyType(String label) {
            this.label = label;
        }
    }

    /** @param created false = it already existed (value is the stored spelling) */
    public record Added(String value, boolean created) {}

    /** Letter/digit first, then letters, digits, spaces and & ' . / - ("Home & Decor", "DIY", "Mother-Baby"). */
    private static final Pattern TAXONOMY_VALUE = Pattern.compile("[\\p{L}\\p{N}][\\p{L}\\p{N} &'./-]{0,39}");

    /** volatile: a refresh on one thread is immediately visible to readers on other threads. */
    private volatile ReferenceData current;

    public ReferenceData get() {
        ReferenceData snapshot = current;
        return snapshot != null ? snapshot : refresh();
    }

    public synchronized ReferenceData refresh() {
        Map<String, String> stateByCity = new LinkedHashMap<>();
        Map<String, String> canonicalCity = new LinkedHashMap<>();
        jdbc.sql("SELECT state, city FROM geo_city ORDER BY state, city")
                .query((rs, n) -> new String[] {rs.getString("state"), rs.getString("city")})
                .list()
                .forEach(r -> {
                    stateByCity.put(r[1].toLowerCase(Locale.ROOT), r[0]);
                    canonicalCity.put(r[1].toLowerCase(Locale.ROOT), r[1]);
                });
        List<String> states = stateByCity.values().stream().distinct().sorted().toList();

        Map<String, String> categories = taxonomy("CATEGORY");
        Map<String, String> languages = taxonomy("LANGUAGE");

        // unmodifiable views of LinkedHashMaps: read-only AND keep the database order (Map.copyOf doesn't)
        current = new ReferenceData(Collections.unmodifiableMap(stateByCity), Collections.unmodifiableMap(canonicalCity),
                states, Collections.unmodifiableMap(categories), Collections.unmodifiableMap(languages));
        log.info("Reference data loaded: {} cities, {} states, {} categories, {} languages",
                canonicalCity.size(), states.size(), categories.size(), languages.size());
        return current;
    }

    /**
     * Adds a custom niche or language. Idempotent: adding "jewellery" when "Jewellery" exists returns "Jewellery"
     * (created = false), so two people adding the same value at once can't create duplicates.
     */
    public Added addTaxonomy(TaxonomyType type, String raw, String actor) {
        String value = capitalize(raw == null ? "" : raw.trim().replaceAll("\\s+", " "));
        if (!TAXONOMY_VALUE.matcher(value).matches()) {
            throw new ValidationException(type.label + " must be 1-40 characters: letters, numbers, spaces and & ' . / -");
        }
        // The unique index on (type, lower(value)) decides; ON CONFLICT turns "already there" into a no-op
        // instead of an error, and is safe under concurrency (no check-then-insert race).
        int inserted = jdbc.sql("""
                        INSERT INTO taxonomy (type, value, is_custom, created_by) VALUES (:type, :value, true, :actor)
                        ON CONFLICT (type, lower(value)) DO NOTHING""")
                .param("type", type.name())
                .param("value", value)
                .param("actor", actor)
                .update();
        Optional<String> stored = lookup(inserted > 0 ? refresh() : get(), type, value);
        if (stored.isEmpty()) {
            stored = lookup(refresh(), type, value); // added by another server instance since our last refresh
        }
        return new Added(stored.orElseThrow(), inserted > 0);
    }

    /** "home & decor" -> "Home & Decor"; words with capitals already ("DIY", "iPhone") are left alone. */
    private static String capitalize(String value) {
        return Arrays.stream(value.split(" "))
                .map(w -> w.isEmpty() || !w.equals(w.toLowerCase(Locale.ROOT)) ? w
                        : w.substring(0, 1).toUpperCase(Locale.ROOT) + w.substring(1))
                .collect(Collectors.joining(" "));
    }

    private static Optional<String> lookup(ReferenceData data, TaxonomyType type, String value) {
        return type == TaxonomyType.CATEGORY ? data.category(value) : data.language(value);
    }

    private Map<String, String> taxonomy(String type) {
        Map<String, String> out = new LinkedHashMap<>();
        jdbc.sql("SELECT value FROM taxonomy WHERE type = :type ORDER BY id")
                .param("type", type)
                .query(String.class)
                .list()
                .forEach(v -> out.put(v.toLowerCase(Locale.ROOT), v));
        return out;
    }
}
