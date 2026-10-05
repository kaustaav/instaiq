package com.influenceiq.crm.common;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Who is making the current request: the signed-in person's email (from their Google token), or "system" for work
 * nobody signed in for (startup demo data, sign-in switched off). Every "created/updated/... by" field comes from
 * here.
 */
@Component
public class CurrentUser {

    public static final String SYSTEM = "system";

    public String name() {
        return signedIn() instanceof JwtAuthenticationToken token && token.getToken().getClaimAsString("email") != null
                ? token.getToken().getClaimAsString("email")
                : SYSTEM;
    }

    /** The signed-in person's details for the UI, or null when nobody is signed in. */
    public Profile profile() {
        if (!(signedIn() instanceof JwtAuthenticationToken token)) return null;
        var jwt = token.getToken();
        return new Profile(jwt.getClaimAsString("email"), jwt.getClaimAsString("name"), jwt.getClaimAsString("picture"));
    }

    public record Profile(String email, String name, String picture) {}

    private static Authentication signedIn() {
        return SecurityContextHolder.getContext().getAuthentication();
    }
}
