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
import java.util.Optional;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One influencer in one campaign (table "campaign_member"). Part of the Campaign aggregate: created and changed
 * only through Campaign, never saved on its own. The influencer is referenced by id, not as an entity: a campaign
 * doesn't load or change influencers.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "campaign_member")
public class CampaignMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Getter(AccessLevel.NONE) // the owner; callers already have it
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_id", nullable = false, updatable = false)
    private Campaign campaign;

    @Column(name = "influencer_id", nullable = false, updatable = false)
    private long influencerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MemberStage stage = MemberStage.SHORTLISTED;
    @Column(name = "stage_reason")
    private String stageReason;
    @Column(name = "stage_updated_at", nullable = false)
    private Instant stageUpdatedAt;
    @Column(name = "stage_updated_by", nullable = false)
    private String stageUpdatedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "compensation_type", nullable = false)
    private Compensation compensation = Compensation.CASH;
    @Column(name = "agreed_fee_inr")
    private Integer agreedFeeInr;
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.NOT_DUE;
    @Column(name = "payment_write_off_reason")
    private String paymentWriteOffReason;

    private String notes;

    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;
    @Column(name = "added_by", nullable = false, updatable = false)
    private String addedBy;

    CampaignMember(Campaign campaign, long influencerId, String actor) { // package-private: only Campaign adds members
        Instant now = Instant.now();
        this.campaign = campaign;
        this.influencerId = influencerId;
        this.stageUpdatedAt = now;
        this.stageUpdatedBy = actor;
        this.addedAt = now;
        this.addedBy = actor;
    }

    /** AGREED becomes IN_PRODUCTION / LIVE / COMPLETED from deliverables and payment (those arrive in later steps). */
    public DisplayStage displayStage() {
        return stage == MemberStage.AGREED ? DisplayStage.IN_PRODUCTION : DisplayStage.valueOf(stage.name());
    }

    /** Why this member can't be removed (paid, or submitted content), if anything. Checks grow with payments/content. */
    Optional<String> removeBlocker() {
        return Optional.empty();
    }
}
