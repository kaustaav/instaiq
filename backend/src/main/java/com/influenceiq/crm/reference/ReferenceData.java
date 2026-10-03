package com.influenceiq.crm.reference;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Immutable snapshot of the reference lists (cities, categories, languages). Lookups are case-insensitive and
 * return the canonical spelling stored in the database ("jewellery" -> "Jewellery").
 *
 * @param stateByCity   lowercase city -> canonical state
 * @param canonicalCity lowercase city -> canonical city
 */
public record ReferenceData(
        Map<String, String> stateByCity,
        Map<String, String> canonicalCity,
        List<String> states,
        Map<String, String> categories,
        Map<String, String> languages) {

    private static String key(String v) {
        return v == null ? "" : v.trim().toLowerCase(Locale.ROOT);
    }

    public Optional<String> city(String raw) {
        return Optional.ofNullable(canonicalCity.get(key(raw)));
    }

    public Optional<String> stateOfCity(String raw) {
        return Optional.ofNullable(stateByCity.get(key(raw)));
    }

    public Optional<String> state(String raw) {
        return states.stream().filter(s -> s.equalsIgnoreCase(raw == null ? "" : raw.trim())).findFirst();
    }

    public Optional<String> category(String raw) {
        return Optional.ofNullable(categories.get(key(raw)));
    }

    public Optional<String> language(String raw) {
        return Optional.ofNullable(languages.get(key(raw)));
    }
}
