package com.influenceiq.crm.influencer;

import java.util.Locale;

/**
 * A valid, normalized Instagram handle: lowercase, no "@", 1-30 of letters, digits, "." and "_".
 * <p>
 * Value object: if you hold an InstagramHandle, it is valid, because the only ways to get one validate.
 * That's why repositories take an InstagramHandle, not a String: an un-normalized lookup can't compile.
 * (A record gives us the constructor, value(), equals/hashCode and toString for free.)
 */
public record InstagramHandle(String value) {

    private static final String VALID = "[a-z0-9._]{1,30}";

    /** Compact constructor: runs on every creation, including when JPA loads a row. */
    public InstagramHandle {
        if (value == null || !value.matches(VALID)) {
            throw new IllegalArgumentException("Not a valid Instagram handle: " + value);
        }
    }

    /**
     * Accepts what people actually paste: "@PriyaJewels", "priyajewels", "https://www.instagram.com/PriyaJewels/",
     * "instagram.com/PriyaJewels". The scheme is optional: without that, "instagram.com/x" would become the bogus
     * handle "instagram.com".
     */
    public static InstagramHandle parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Instagram handle is required");
        }
        String h = raw.trim()
                .replaceFirst("(?i)^(https?://)?(www\\.)?instagram\\.com/", "")
                .replaceAll("[/?#].*$", "")
                .replaceFirst("^@", "")
                .toLowerCase(Locale.ROOT);
        return new InstagramHandle(h);
    }

    /** Profile link, as the UI shows it. */
    public String profileUrl() {
        return "https://www.instagram.com/" + value + "/";
    }

    @Override
    public String toString() {
        return "@" + value;
    }
}
