package com.influenceiq.crm.campaign;

import com.influenceiq.crm.common.RuleViolationException;
import com.influenceiq.crm.common.ValidationException;
import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One reel / story / post a member owes (table "campaign_deliverable"), with its draft review rounds.
 * Part of the Campaign aggregate: changed only through Campaign. Rules mirror frontend/src/lib/campaigns.ts.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "campaign_deliverable")
public class Deliverable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Getter(AccessLevel.NONE)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false, updatable = false)
    private CampaignMember member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private DeliverableType type;
    @Column(nullable = false, updatable = false)
    private int seq;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeliverableStatus status = DeliverableStatus.AWAITING_DRAFT;
    @Column(name = "live_url")
    private String liveUrl;
    @Column(name = "posted_at")
    private LocalDate postedAt;

    @OneToMany(mappedBy = "deliverable", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("round ASC")
    private List<DraftRevision> revisions = new ArrayList<>();

    Deliverable(CampaignMember member, DeliverableType type, int seq) {
        this.member = member;
        this.type = type;
        this.seq = seq;
    }

    public List<DraftRevision> getRevisions() {
        return List.copyOf(revisions);
    }

    /** Anything on record (a draft was submitted, or it's live): such content must stay. */
    boolean hasWork() {
        return !revisions.isEmpty() || status == DeliverableStatus.POSTED;
    }

    void submitDraft(String url, String actor) {
        if (status != DeliverableStatus.AWAITING_DRAFT && status != DeliverableStatus.CHANGES_REQUESTED) {
            throw new RuleViolationException("This deliverable isn't waiting for a draft");
        }
        if (!Links.isWebLink(url)) throw new ValidationException("Enter a valid draft link (https://…)");
        revisions.add(new DraftRevision(this, revisions.size() + 1, url.trim(), actor));
        status = DeliverableStatus.IN_REVIEW;
    }

    void review(ReviewDecision decision, String feedback, String actor) {
        if (status != DeliverableStatus.IN_REVIEW) throw new RuleViolationException("No draft is waiting for review");
        if (decision == null) throw new ValidationException("decision is required");
        boolean noFeedback = feedback == null || feedback.isBlank();
        if (decision == ReviewDecision.CHANGES_REQUESTED && noFeedback) throw new ValidationException("Tell them what to change");
        revisions.getLast().review(decision, noFeedback ? null : feedback.trim(), actor);
        status = decision == ReviewDecision.APPROVED ? DeliverableStatus.APPROVED : DeliverableStatus.CHANGES_REQUESTED;
    }

    /** The campaign checks that the link isn't already used by another deliverable. */
    void markPosted(String url, LocalDate date) {
        if (status != DeliverableStatus.APPROVED) throw new RuleViolationException("Only an approved draft can be posted");
        liveUrl = url.trim();
        postedAt = date;
        status = DeliverableStatus.POSTED;
    }
}
