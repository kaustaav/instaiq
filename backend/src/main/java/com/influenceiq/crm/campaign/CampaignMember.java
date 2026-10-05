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
import com.influenceiq.crm.common.RuleViolationException;
import com.influenceiq.crm.common.ValidationException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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

    /** The stages people move through, in order (DECLINED sits outside it). */
    private static final List<MemberStage> ORDER =
            List.of(MemberStage.SHORTLISTED, MemberStage.CONTACTED, MemberStage.NEGOTIATING, MemberStage.AGREED);

    /** One stage change people can make from here. AGREED is reached by agreeing terms, not by a move. */
    public record Move(MemberStage to, boolean needsReason) {}

    /** Mirrors stageMoves() in frontend/src/lib/campaigns.ts. */
    public List<Move> moves() {
        if (stage == MemberStage.DECLINED) return List.of(new Move(MemberStage.SHORTLISTED, true)); // re-shortlist
        List<Move> out = new ArrayList<>();
        if (stage == MemberStage.SHORTLISTED) out.add(new Move(MemberStage.CONTACTED, false));
        if (stage == MemberStage.CONTACTED) out.add(new Move(MemberStage.NEGOTIATING, false));
        int i = ORDER.indexOf(stage);
        // one step back, with a reason; un-agreeing only before any content or money (it drops the terms)
        if (i > 0 && (stage != MemberStage.AGREED || removeBlocker().isEmpty())) out.add(new Move(ORDER.get(i - 1), true));
        if (stage != MemberStage.AGREED) out.add(new Move(MemberStage.DECLINED, false));
        return out;
    }

    void moveTo(MemberStage to, String reason, String actor) { // package-private: only through Campaign
        Move move = moves().stream().filter(m -> m.to() == to).findFirst().orElseThrow(() -> new RuleViolationException(
                "Can't move from " + lower(stage) + " to " + lower(to)));
        if (move.needsReason() && isBlank(reason)) throw new ValidationException("A reason is required");
        if (stage == MemberStage.AGREED) {
            // stepping back from agreed drops the terms
            agreedFeeInr = null;
            compensation = Compensation.CASH;
            paymentStatus = PaymentStatus.NOT_DUE;
            paymentWriteOffReason = null;
        }
        stage = to;
        stageReason = isBlank(reason) ? null : reason.trim();
        stageUpdatedAt = Instant.now();
        stageUpdatedBy = actor;
    }

    void updateNotes(String notes) {
        this.notes = isBlank(notes) ? null : notes.trim();
    }

    /** Content is live but not fully paid: blocks cancelling. Needs deliverables and payments (later steps). */
    boolean hasLiveUnpaid() {
        return false;
    }

    private static boolean isBlank(String v) {
        return v == null || v.isBlank();
    }

    private static String lower(Enum<?> e) {
        return e.name().toLowerCase(Locale.ROOT).replace('_', ' ');
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
