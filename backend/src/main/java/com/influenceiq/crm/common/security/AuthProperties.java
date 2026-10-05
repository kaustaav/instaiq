package com.influenceiq.crm.common.security;

import java.util.List;
import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.auth.* from application.properties (filled from environment variables). Spring converts the comma-separated
 * values into lists.
 *
 * @param allowedDomains Google Workspace domains whose members may sign in (matched against the token's "hd")
 * @param allowedEmails  individual accounts that may sign in, e.g. the owner's personal Gmail
 */
@ConfigurationProperties("app.auth")
public record AuthProperties(boolean enabled, String googleClientId, List<String> allowedDomains, List<String> allowedEmails) {

    public AuthProperties {
        allowedDomains = normalize(allowedDomains);
        allowedEmails = normalize(allowedEmails);
    }

    private static List<String> normalize(List<String> values) {
        return values == null ? List.of()
                : values.stream().map(v -> v.trim().toLowerCase(Locale.ROOT)).filter(v -> !v.isEmpty()).toList();
    }
}
