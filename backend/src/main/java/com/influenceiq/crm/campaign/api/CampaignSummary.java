package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.Campaign;
import com.influenceiq.crm.campaign.CampaignMember;
import com.influenceiq.crm.campaign.CampaignStatus;
import com.influenceiq.crm.campaign.Deliverable;
import com.influenceiq.crm.campaign.DeliverableStatus;
import com.influenceiq.crm.campaign.DisplayStage;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** One card on the campaign list: no member details, just the counts the card shows. */
public record CampaignSummary(
        long id,
        String name,
        String brand,
        CampaignStatus status,
        LocalDate startDate,
        LocalDate endDate,
        Integer budgetInr,
        int budgetUsedInr,
        CampaignResponse.Targets targets,
        int memberCount,
        Map<DisplayStage, Long> stageCounts, // only stages with members
        int deliverables,
        int posted,
        int inReview,
        int unpaid, // members whose content is live but not fully paid
        Instant createdAt) {

    static CampaignSummary from(Campaign c) {
        Map<DisplayStage, Long> stages = c.getMembers().stream().collect(Collectors.groupingBy(
                CampaignMember::displayStage, () -> new EnumMap<>(DisplayStage.class), Collectors.counting()));
        return new CampaignSummary(c.getId(), c.getName(), c.getBrand(), c.getStatus(), c.getStartDate(),
                c.getEndDate(), c.getBudgetInr(), c.budgetUsedInr(), CampaignResponse.Targets.of(c), c.getMembers().size(),
                stages, (int) all(c).count(), (int) all(c).filter(d -> d.getStatus() == DeliverableStatus.POSTED).count(),
                (int) all(c).filter(d -> d.getStatus() == DeliverableStatus.IN_REVIEW).count(),
                (int) c.getMembers().stream().filter(CampaignMember::hasLiveUnpaid).count(), c.getCreatedAt());
    }

    private static Stream<Deliverable> all(Campaign c) {
        return c.getMembers().stream().flatMap(m -> m.getDeliverables().stream());
    }
}
