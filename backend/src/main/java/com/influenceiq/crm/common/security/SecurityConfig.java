package com.influenceiq.crm.common.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Sign-in with Google, for the whole app (Spring Security).
 * <ul>
 *   <li>The UI signs people in with Google and sends the token with every request ("Authorization: Bearer ...").</li>
 *   <li>Every /api request is checked: valid Google token for our app (else 401), and an allowed person (else 403).
 *       The server keeps no sessions: each request proves itself.</li>
 *   <li>/actuator/health stays open ("is it up?"); everything else is closed.</li>
 * </ul>
 * Off only with AUTH_ENABLED=false (laptop experiments); on, it refuses to start without GOOGLE_CLIENT_ID.
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfig {

    @Bean
    SecurityFilterChain security(HttpSecurity http, AuthProperties auth) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)   // CSRF attacks ride on cookies; we use no cookies, only a header
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!auth.enabled()) {
            log.warn("Sign-in is OFF (AUTH_ENABLED=false): anyone who can reach this server can use the API");
            return http.authorizeHttpRequests(a -> a.anyRequest().permitAll()).build();
        }
        if (auth.googleClientId() == null || auth.googleClientId().isBlank()) {
            throw new IllegalStateException("Sign-in is on but GOOGLE_CLIENT_ID is not set (or set AUTH_ENABLED=false on a laptop)");
        }
        if (auth.allowedDomains().isEmpty() && auth.allowedEmails().isEmpty()) {
            log.warn("Sign-in: ALLOWED_DOMAINS and ALLOWED_EMAILS are empty, so nobody can use the API");
        }
        log.info("Sign-in: Google, allowing {} domain(s) and {} email(s)", auth.allowedDomains().size(), auth.allowedEmails().size());

        return http
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll() // CORS preflight carries no token
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/api/**").access(new AllowedUsers(auth))
                        .anyRequest().denyAll())
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.decoder(GoogleTokens.decoder(auth.googleClientId())))
                        .authenticationEntryPoint((req, res, e) -> problem(res, 401, "Not signed in", "Sign in to continue"))
                        .accessDeniedHandler((req, res, e) -> problem(res, 403, "No access", "You don't have access to InfluenceIQ")))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> problem(res, 401, "Not signed in", "Sign in to continue"))
                        .accessDeniedHandler((req, res, ex) -> problem(res, 403, "No access", "You don't have access to InfluenceIQ")))
                .build();
    }

    /** Same JSON shape as every other API error (RFC 9457), so the UI shows these like any other message. */
    private static void problem(HttpServletResponse res, int status, String title, String detail) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        res.getWriter().write("{\"title\":\"%s\",\"status\":%d,\"detail\":\"%s\"}".formatted(title, status, detail));
    }
}
