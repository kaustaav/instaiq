package com.influenceiq.crm.campaign;

import com.influenceiq.crm.common.Auditable;
import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.common.RuleViolationException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A campaign and its members: one aggregate. Every change to a member goes through this class, so rules that
 * span the whole campaign (read-only states, one influencer once, later: "complete" needs every member done)
 * are checked in one place. Rules mirror frontend/src/lib/campaigns.ts.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "campaign")
public class Campaign extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String brand;
    private String brief;
    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    @Column(name = "budget_inr")
    private Integer budgetInr;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CampaignStatus status = CampaignStatus.DRAFT;
    @Enumerated(EnumType.STRING)
    @Column(name = "archived_from")
    private CampaignStatus archivedFrom;
    @Column(name = "status_reason")
    private String statusReason;
    @Column(name = "status_changed_at", nullable = false)
    private Instant statusChangedAt;
    @Column(name = "status_changed_by", nullable = false)
    private String statusChangedBy;

    // cascade: saving the campaign saves its members; orphanRemoval: removing one from the list deletes the row
    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("addedAt ASC, id ASC")
    private List<CampaignMember> members = new ArrayList<>();

    public Campaign(CampaignDetails details, String actor) {
        apply(details);
        this.statusChangedAt = Instant.now();
        this.statusChangedBy = actor;
    }

    public void updateDetails(CampaignDetails details) {
        assertEditable();
        apply(details);
    }

    public boolean isReadOnly() {
        return status.isReadOnly();
    }

    /** Read-only view: members change only through addMember/removeMember. */
    public List<CampaignMember> getMembers() {
        return List.copyOf(members);
    }

    public Optional<CampaignMember> member(long influencerId) {
        return members.stream().filter(m -> m.getInfluencerId() == influencerId).findFirst();
    }

    /** @return false if the influencer is already in this campaign (nothing changes) */
    public boolean addMember(long influencerId, String actor) {
        assertEditable();
        if (member(influencerId).isPresent()) return false;
        members.add(new CampaignMember(this, influencerId, actor));
        return true;
    }

    public void removeMember(long influencerId) {
        assertEditable();
        CampaignMember m = member(influencerId).orElseThrow(() -> new NotFoundException("Campaign member", influencerId));
        m.removeBlocker().ifPresent(reason -> { throw new RuleViolationException(reason); });
        members.remove(m);
    }

    /** Agreed fees of members whose terms are agreed. Over budget is a warning, never a block. */
    public int budgetUsedInr() {
        return members.stream()
                .filter(m -> m.getStage() == MemberStage.AGREED && m.getAgreedFeeInr() != null)
                .mapToInt(CampaignMember::getAgreedFeeInr)
                .sum();
    }

    private void apply(CampaignDetails d) {
        this.name = d.name();
        this.brand = d.brand();
        this.brief = d.brief();
        this.startDate = d.startDate();
        this.endDate = d.endDate();
        this.budgetInr = d.budgetInr();
    }

    private void assertEditable() {
        if (isReadOnly()) {
            throw new RuleViolationException("This campaign is " + status.name().toLowerCase(Locale.ROOT)
                    + " and read-only. Reopen it to make changes.");
        }
    }
}
