package com.influenceiq.crm.common.security;

import java.util.List;
import java.util.Set;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Checking a Google sign-in token (an "ID token", a JWT). The decoder verifies Google's signature with Google's
 * public keys (downloaded on first use and cached), then the validator checks what the token says.
 */
public final class GoogleTokens {

    /** Google's published public keys. Only Google has the private keys that match them. */
    static final String KEYS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    private GoogleTokens() {
    }

    static JwtDecoder decoder(String clientId) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(KEYS).build();
        decoder.setJwtValidator(validator(clientId));
        return decoder;
    }

    /**
     * Not expired (with a little clock leeway), issued by Google, and issued for <b>our</b> app: a genuine Google
     * token made for some other website is refused.
     */
    public static OAuth2TokenValidator<Jwt> validator(String clientId) {
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),
                new JwtClaimValidator<String>("iss", ISSUERS::contains),
                new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(clientId)));
    }
}
