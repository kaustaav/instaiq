package com.influenceiq.crm.campaign;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** One round of the draft review loop (table "deliverable_revision"). Written once on submit, once on review. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "deliverable_revision")
public class DraftRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Getter(AccessLevel.NONE)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "deliverable_id", nullable = false, updatable = false)
    private Deliverable deliverable;

    @Column(nullable = false, updatable = false)
    private int round;
    @Column(name = "draft_url", nullable = false, updatable = false)
    private String draftUrl;
    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt;
    @Column(name = "submitted_by", nullable = false, updatable = false)
    private String submittedBy;

    @Enumerated(EnumType.STRING)
    private ReviewDecision decision;
    private String feedback;
    @Column(name = "reviewed_at")
    private Instant reviewedAt;
    @Column(name = "reviewed_by")
    private String reviewedBy;

    DraftRevision(Deliverable deliverable, int round, String draftUrl, String actor) {
        this.deliverable = deliverable;
        this.round = round;
        this.draftUrl = draftUrl;
        this.submittedAt = Instant.now();
        this.submittedBy = actor;
    }

    boolean isReviewed() {
        return decision != null;
    }

    void review(ReviewDecision decision, String feedback, String actor) {
        this.decision = decision;
        this.feedback = feedback;
        this.reviewedAt = Instant.now();
        this.reviewedBy = actor;
    }
}
