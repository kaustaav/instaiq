package com.influenceiq.crm.common;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import lombok.Getter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * "Who created this row, and when", filled in automatically by Spring Data JPA auditing on insert.
 * For append-only tables (e.g. rate cards) that are never updated.
 */
@Getter
@MappedSuperclass // not a table itself; its fields become columns of each subclass's table
@EntityListeners(AuditingEntityListener.class) // the listener that fills the @Created* fields
public abstract class CreatedAudit {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @CreatedBy
    @Column(name = "created_by", nullable = false, updatable = false)
    private String createdBy;

}
