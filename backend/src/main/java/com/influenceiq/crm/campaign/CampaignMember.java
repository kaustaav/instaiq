package com.influenceiq.crm.campaign;

import com.influenceiq.crm.common.NotFoundException;
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

    // created when terms are agreed (reels, then stories, then posts: id order is creation order)
    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<Deliverable> deliverables = new ArrayList<>();

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

    public List<Deliverable> getDeliverables() {
        return List.copyOf(deliverables);
    }

    Deliverable deliverable(long deliverableId) {
        return deliverables.stream().filter(d -> d.getId() == deliverableId).findFirst()
                .orElseThrow(() -> new NotFoundException("Deliverable", deliverableId));
    }

    /**
     * NEGOTIATING -> AGREED: records compensation and fee, creates one deliverable per reel/story/post, and makes
     * payment DUE (WAIVED for barter: nothing to pay in cash).
     */
    void agreeTerms(Compensation compensation, Integer feeInr, int reels, int stories, int posts, String actor) {
        if (stage != MemberStage.NEGOTIATING) throw new RuleViolationException("Terms are agreed from the negotiating stage");
        if (compensation == null) throw new ValidationException("compensation is required");
        List<String> errors = new ArrayList<>();
        if (reels < 0 || stories < 0 || posts < 0) errors.add("Deliverable counts can't be negative");
        else if (reels + stories + posts < 1) errors.add("Add at least one deliverable");
        boolean barter = compensation == Compensation.BARTER;
        if (!barter && (feeInr == null || feeInr <= 0)) errors.add("Agreed fee is required for paid collaborations");
        if (!errors.isEmpty()) throw new ValidationException(errors);

        for (int i = 1; i <= reels; i++) deliverables.add(new Deliverable(this, DeliverableType.REEL, i));
        for (int i = 1; i <= stories; i++) deliverables.add(new Deliverable(this, DeliverableType.STORY, i));
        for (int i = 1; i <= posts; i++) deliverables.add(new Deliverable(this, DeliverableType.POST, i));
        this.compensation = compensation;
        this.agreedFeeInr = barter ? null : feeInr;
        this.paymentStatus = barter ? PaymentStatus.WAIVED : PaymentStatus.DUE;
        this.stage = MemberStage.AGREED;
        this.stageReason = null;
        this.stageUpdatedAt = Instant.now();
        this.stageUpdatedBy = actor;
    }

    /** Content is live but not fully paid: blocks cancelling the campaign. */
    public boolean hasLiveUnpaid() {
        return deliverables.stream().anyMatch(d -> d.getStatus() == DeliverableStatus.POSTED)
                && (paymentStatus == PaymentStatus.DUE || paymentStatus == PaymentStatus.PARTIALLY_PAID);
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
            // stepping back from agreed drops the terms (allowed only while no content is on record)
            deliverables.clear();
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

    private static boolean isBlank(String v) {
        return v == null || v.isBlank();
    }

    private static String lower(Enum<?> e) {
        return e.name().toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    /** AGREED shows as IN_PRODUCTION until everything is posted, then LIVE until paid (or waived), then COMPLETED. */
    public DisplayStage displayStage() {
        if (stage != MemberStage.AGREED) return DisplayStage.valueOf(stage.name());
        boolean allPosted = !deliverables.isEmpty() && deliverables.stream().allMatch(d -> d.getStatus() == DeliverableStatus.POSTED);
        if (!allPosted) return DisplayStage.IN_PRODUCTION;
        return paymentStatus == PaymentStatus.PAID || paymentStatus == PaymentStatus.WAIVED ? DisplayStage.COMPLETED : DisplayStage.LIVE;
    }

    public boolean canBeRemoved() {
        return removeBlocker().isEmpty();
    }

    /** Why this member can't be removed or un-agreed, if anything. (Payments join this check in the next step.) */
    Optional<String> removeBlocker() {
        if (deliverables.stream().anyMatch(Deliverable::hasWork)) return Optional.of("They have submitted content; it must stay on record");
        return Optional.empty();
    }
}
