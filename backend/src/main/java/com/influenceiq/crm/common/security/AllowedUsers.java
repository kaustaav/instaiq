package com.influenceiq.crm.common.security;

import java.util.Locale;
import java.util.function.Supplier;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.authorization.AuthorizationResult;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

/**
 * Who may use the API once Google has said who they are: a verified email that is on the allow-list, or whose
 * Google Workspace domain ("hd" claim) is allowed. The domain comes from "hd", not from the email text: only Google
 * Workspace sets it, so a personal account can't claim to be in the company's domain.
 */
public class AllowedUsers implements AuthorizationManager<RequestAuthorizationContext> {

    private final AuthProperties auth;

    public AllowedUsers(AuthProperties auth) {
        this.auth = auth;
    }

    @Override
    public AuthorizationResult authorize(Supplier<? extends Authentication> authentication, RequestAuthorizationContext context) {
        return new AuthorizationDecision(authentication.get() instanceof JwtAuthenticationToken token && isAllowed(token.getToken()));
    }

    boolean isAllowed(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email == null || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) return false;
        if (auth.allowedEmails().contains(email.toLowerCase(Locale.ROOT))) return true;
        String domain = jwt.getClaimAsString("hd");
        return domain != null && auth.allowedDomains().contains(domain.toLowerCase(Locale.ROOT));
    }
}
