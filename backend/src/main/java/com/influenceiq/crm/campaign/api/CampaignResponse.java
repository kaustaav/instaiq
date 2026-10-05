package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.Campaign;
import com.influenceiq.crm.campaign.CampaignMember;
import com.influenceiq.crm.campaign.CampaignStatus;
import com.influenceiq.crm.campaign.Compensation;
import com.influenceiq.crm.campaign.DisplayStage;
import com.influenceiq.crm.campaign.MemberStage;
import com.influenceiq.crm.campaign.PaymentStatus;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** The whole campaign with its members, as GET /api/campaigns/{id} returns it. */
public record CampaignResponse(
        long id,
        String name,
        String brand,
        String brief,
        LocalDate startDate,
        LocalDate endDate,
        Integer budgetInr,
        int budgetUsedInr,
        Targets targets,
        CampaignStatus status,
        CampaignStatus archivedFrom,
        String statusReason,
        Instant statusChangedAt,
        String statusChangedBy,
        Instant createdAt,
        String createdBy,
        Instant updatedAt,
        int version,
        List<MemberView> members) {

    /** What the brand wants. Content counts are campaign totals; null = not specified. */
    public record Targets(int influencers, Integer reels, Integer stories, Integer posts) {

        static Targets of(Campaign c) {
            return new Targets(c.getTargetInfluencers(), c.getTargetReels(), c.getTargetStories(), c.getTargetPosts());
        }
    }

    /** Just enough of the influencer for the campaign screens (cards, pipeline). */
    public record InfluencerBrief(long id, String handle, String name, int followers, BigDecimal engagementRate,
                                  InfluencerStatus status, List<String> cities, List<String> states,
                                  List<String> categories) {

        static InfluencerBrief from(Influencer i) {
            return new InfluencerBrief(i.getId(), i.getHandle().value(), i.getName(), i.getFollowers(),
                    i.getEngagementRate(), i.getStatus(), i.getCities(), i.getStates(), i.getCategories());
        }
    }

    public record MemberView(InfluencerBrief influencer, MemberStage stage, DisplayStage displayStage,
                             String stageReason, Instant stageUpdatedAt, String stageUpdatedBy,
                             Compensation compensation, Integer agreedFeeInr, PaymentStatus paymentStatus,
                             String paymentWriteOffReason, String notes, Instant addedAt, String addedBy) {

        static MemberView from(CampaignMember m, Influencer i) {
            return new MemberView(InfluencerBrief.from(i), m.getStage(), m.displayStage(), m.getStageReason(),
                    m.getStageUpdatedAt(), m.getStageUpdatedBy(), m.getCompensation(), m.getAgreedFeeInr(),
                    m.getPaymentStatus(), m.getPaymentWriteOffReason(), m.getNotes(), m.getAddedAt(), m.getAddedBy());
        }
    }

    /** @param influencers every member's influencer, by id */
    static CampaignResponse from(Campaign c, Map<Long, Influencer> influencers) {
        return new CampaignResponse(c.getId(), c.getName(), c.getBrand(), c.getBrief(), c.getStartDate(),
                c.getEndDate(), c.getBudgetInr(), c.budgetUsedInr(), Targets.of(c), c.getStatus(), c.getArchivedFrom(),
                c.getStatusReason(), c.getStatusChangedAt(), c.getStatusChangedBy(), c.getCreatedAt(),
                c.getCreatedBy(), c.getUpdatedAt(), c.getVersion(),
                c.getMembers().stream().map(m -> MemberView.from(m, influencers.get(m.getInfluencerId()))).toList());
    }
}
