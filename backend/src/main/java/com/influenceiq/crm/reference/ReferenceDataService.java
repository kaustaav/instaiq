package com.influenceiq.crm.reference;

import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.common.RuleViolationException;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

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
    private final PlatformTransactionManager transactions;

    /**
     * The two lists in the taxonomy table. `label` is how the UI calls it (error messages); `column` is the influencer
     * array column holding the values (a fixed name, never user input, so it's safe to put in SQL).
     */
    public enum TaxonomyType {
        CATEGORY("Niche", "categories"), LANGUAGE("Language", "languages");

        private final String label;
        private final String column;

        TaxonomyType(String label, String column) {
            this.label = label;
            this.column = column;
        }
    }

    /** A custom (user-added) value and how many influencers use it. */
    public record CustomValue(String value, long usedBy) {}

    public record CustomValues(List<CustomValue> categories, List<CustomValue> languages) {}

    /**
     * @param merged             the new name already existed, so the two became one
     * @param influencersUpdated how many influencers had the old name
     */
    public record Renamed(String value, boolean merged, int influencersUpdated) {}

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
        String value = normalize(type, raw);
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

    /** Custom niches and languages (built-in ones aren't listed: they can't be changed), with usage counts. */
    public CustomValues customValues() {
        return new CustomValues(custom(TaxonomyType.CATEGORY), custom(TaxonomyType.LANGUAGE));
    }

    private List<CustomValue> custom(TaxonomyType type) {
        return jdbc.sql("""
                        SELECT t.value, (SELECT count(*) FROM influencer i WHERE t.value = ANY(i.%s)) AS used_by
                        FROM taxonomy t WHERE t.type = :type AND t.is_custom ORDER BY t.id""".formatted(type.column))
                .param("type", type.name())
                .query((rs, n) -> new CustomValue(rs.getString("value"), rs.getLong("used_by")))
                .list();
    }

    /**
     * Renames a custom niche/language everywhere: in the list and on every influencer that has it. Renaming onto a
     * name that already exists merges the two (no duplicates on anyone; the old name disappears). Every changed
     * influencer gets a new version, so someone editing one at the same moment gets "changed by someone else"
     * instead of quietly saving the old name back. One transaction: all of it happens, or none.
     */
    public Renamed renameTaxonomy(TaxonomyType type, String fromRaw, String toRaw, String actor) {
        String from = lookup(get(), type, fromRaw == null ? "" : fromRaw.trim())
                .orElseThrow(() -> new NotFoundException(type.label, fromRaw));
        requireCustom(type, from);
        String to = normalize(type, toRaw);
        Optional<String> existing = lookup(get(), type, to);
        boolean merge = existing.isPresent() && !existing.get().equalsIgnoreCase(from); // case-only change = rename
        String target = merge ? existing.get() : to;

        Integer updated = new TransactionTemplate(transactions).execute(tx -> {
            // already has the target (merge): just drop the old name; otherwise replace it in place (keeps the order)
            int n = jdbc.sql("""
                            UPDATE influencer
                            SET %1$s = CASE WHEN :target = ANY(%1$s) THEN array_remove(%1$s, :from)
                                            ELSE array_replace(%1$s, :from, :target) END,
                                version = version + 1, updated_at = now(), updated_by = :actor
                            WHERE :from = ANY(%1$s)""".formatted(type.column))
                    .param("from", from).param("target", target).param("actor", actor)
                    .update();
            String sql = merge ? "DELETE FROM taxonomy WHERE type = :type AND value = :from"
                    : "UPDATE taxonomy SET value = :target WHERE type = :type AND value = :from";
            jdbc.sql(sql).param("type", type.name()).param("from", from).param("target", target).update();
            return n;
        });
        refresh(); // after the commit, so the cache never shows a change that was rolled back
        log.info("{} renamed: \"{}\" -> \"{}\" ({}, {} influencers) by {}", type.label, from, target,
                merge ? "merged" : "renamed", updated, actor);
        return new Renamed(target, merge, updated == null ? 0 : updated);
    }

    /** Deletes a custom niche/language that no influencer uses (every influencer needs at least one niche). */
    public void removeTaxonomy(TaxonomyType type, String raw) {
        String value = lookup(get(), type, raw == null ? "" : raw.trim())
                .orElseThrow(() -> new NotFoundException(type.label, raw));
        requireCustom(type, value);
        long used = jdbc.sql("SELECT count(*) FROM influencer WHERE :value = ANY(%s)".formatted(type.column))
                .param("value", value).query(Long.class).single();
        if (used > 0) {
            throw new RuleViolationException("\"%s\" is used by %d influencer%s. Rename or merge it instead."
                    .formatted(value, used, used == 1 ? "" : "s"));
        }
        jdbc.sql("DELETE FROM taxonomy WHERE type = :type AND value = :value")
                .param("type", type.name()).param("value", value).update();
        refresh();
    }

    private void requireCustom(TaxonomyType type, String value) {
        boolean custom = jdbc.sql("SELECT is_custom FROM taxonomy WHERE type = :type AND value = :value")
                .param("type", type.name()).param("value", value).query(Boolean.class).single();
        if (!custom) {
            throw new RuleViolationException("\"%s\" is built in and can't be changed".formatted(value));
        }
    }

    /** Trimmed, single spaces, capitalized, and within the allowed characters. */
    private static String normalize(TaxonomyType type, String raw) {
        String value = capitalize(raw == null ? "" : raw.trim().replaceAll("\\s+", " "));
        if (!TAXONOMY_VALUE.matcher(value).matches()) {
            throw new ValidationException(type.label + " must be 1-40 characters: letters, numbers, spaces and & ' . / -");
        }
        return value;
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
