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

    /** Kept for existing callers; the source of truth is CurrentUser. */
    public static final String SYSTEM_USER = CurrentUser.SYSTEM;

    /** Who is making the change. Spring calls this whenever it fills @CreatedBy / @LastModifiedBy. */
    @Bean
    AuditorAware<String> auditorAware(CurrentUser currentUser) {
        return () -> Optional.of(currentUser.name());
    }
}
