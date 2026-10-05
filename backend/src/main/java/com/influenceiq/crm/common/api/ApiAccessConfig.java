package com.influenceiq.crm.common.api;

import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * CORS: which other websites (origins) a browser may call /api from, e.g. the Amplify UI when the API is on another
 * address. Empty = same site only (local dev goes through the Vite proxy, so it needs none). Runs first, so even a
 * 401 carries CORS headers and the browser shows the real error. From the CORS_ORIGINS environment variable, so
 * the same build runs locally and on AWS.
 */
@Slf4j
@Configuration
public class ApiAccessConfig {

    @Bean
    FilterRegistrationBean<CorsFilter> corsFilter(@Value("${app.cors.allowed-origins:}") String origins) {
        List<String> allowed = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(allowed);
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Content-Type", "Accept", "If-None-Match", "Authorization"));
        cors.setExposedHeaders(List.of("Location", "ETag")); // headers our UI reads from responses
        cors.setMaxAge(3600L); // browsers may skip the extra "preflight" request for an hour
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cors);
        log.info("CORS: {}", allowed.isEmpty() ? "same site only" : "allowing " + allowed);

        FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter(source));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }
}
