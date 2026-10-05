package com.influenceiq.crm.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.influenceiq.crm.common.security.GoogleTokens;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;

/** What a correctly signed Google token must also say before we accept it. */
class GoogleTokensTest {

    private final OAuth2TokenValidator<Jwt> validator = GoogleTokens.validator("our-client-id");

    private static Jwt token(String issuer, String audience, Instant expires) {
        return Jwt.withTokenValue("t").header("alg", "RS256").issuer(issuer).audience(List.of(audience))
                .issuedAt(expires.minusSeconds(3600)).expiresAt(expires).claim("email", "a@example.com").build();
    }

    @Test
    void acceptsAFreshTokenFromGoogleForOurApp() {
        assertThat(validator.validate(token("https://accounts.google.com", "our-client-id", Instant.now().plusSeconds(600))).hasErrors()).isFalse();
    }

    @Test
    void refusesOtherAppsOtherIssuersAndExpiredTokens() {
        Instant later = Instant.now().plusSeconds(600);
        assertThat(validator.validate(token("https://accounts.google.com", "someone-elses-app", later)).hasErrors()).isTrue();
        assertThat(validator.validate(token("https://evil.example", "our-client-id", later)).hasErrors()).isTrue();
        assertThat(validator.validate(token("https://accounts.google.com", "our-client-id", Instant.now().minusSeconds(600))).hasErrors()).isTrue();
    }
}
