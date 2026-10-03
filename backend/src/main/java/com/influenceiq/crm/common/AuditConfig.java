package com.influenceiq.crm.common;

import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** Turns on JPA auditing (the @CreatedBy / @LastModifiedDate fields in CreatedAudit and Auditable). */
@Configuration
@EnableJpaAuditing
public class AuditConfig {

    /** Placeholder until login exists; then this returns the signed-in user's email. */
    public static final String SYSTEM_USER = "system";

    /** Who is making the change. Spring calls this whenever it fills @CreatedBy / @LastModifiedBy. */
    @Bean
    AuditorAware<String> auditorAware() {
        return () -> Optional.of(SYSTEM_USER);
    }
}
