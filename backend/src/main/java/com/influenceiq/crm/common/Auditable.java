package com.influenceiq.crm.common;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import java.time.Instant;
import lombok.Getter;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;

/**
 * For editable tables: created + last-updated audit fields, plus optimistic locking.
 */
@Getter
@MappedSuperclass
public abstract class Auditable extends CreatedAudit {

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @LastModifiedBy
    @Column(name = "updated_by", nullable = false)
    private String updatedBy;

    /**
     * Optimistic locking: Hibernate adds "WHERE version = ?" to every UPDATE and increments it.
     * If two people edit the same row, the second save fails instead of silently overwriting the first.
     */
    @Version
    @Column(name = "version", nullable = false)
    private int version;

}
