package com.influenceiq.crm.reference;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
