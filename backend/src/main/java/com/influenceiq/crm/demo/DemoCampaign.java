package com.influenceiq.crm.demo;

import com.influenceiq.crm.campaign.CampaignStatus;
import com.influenceiq.crm.campaign.Compensation;
import com.influenceiq.crm.campaign.DeliverableStatus;
import com.influenceiq.crm.campaign.DeliverableType;
import com.influenceiq.crm.campaign.MemberStage;
import com.influenceiq.crm.campaign.ReviewDecision;
import java.time.LocalDate;
import java.util.List;

/**
 * One campaign in src/main/resources/demo/campaigns.json (exported from the UI's demo data by
 * frontend/scripts/export-demo-campaigns.mjs): the state to reach, which DemoCampaignLoader replays step by step.
 */
record DemoCampaign(String name, String brand, String brief, LocalDate startDate, LocalDate endDate, Integer budgetInr,
                    int targetInfluencers, Integer targetReels, Integer targetStories, Integer targetPosts,
                    CampaignStatus status, String statusReason, CampaignStatus archivedFrom, List<Member> members) {

    record Member(String handle, MemberStage stage, String stageReason, String notes, Compensation compensation,
                  Integer feeInr, String paymentWriteOffReason, List<Deliverable> deliverables, List<Payment> payments) {}

    record Deliverable(DeliverableType type, int seq, DeliverableStatus status, String liveUrl, LocalDate postedAt,
                       List<Revision> revisions) {}

    record Revision(String draftUrl, ReviewDecision decision, String feedback) {}

    record Payment(int amountInr, LocalDate paidAt, String receiptUrl) {}
}
