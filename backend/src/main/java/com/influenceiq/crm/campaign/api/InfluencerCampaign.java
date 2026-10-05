package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.Campaign;
import com.influenceiq.crm.campaign.CampaignMember;
import com.influenceiq.crm.campaign.CampaignStatus;
import com.influenceiq.crm.campaign.DeliverableStatus;
import com.influenceiq.crm.campaign.DisplayStage;
import com.influenceiq.crm.campaign.MemberStage;
import java.time.LocalDate;

/** One campaign an influencer is in, with where they are in it. */
public record InfluencerCampaign(long campaignId, String name, String brand, LocalDate startDate, LocalDate endDate,
                                 CampaignStatus campaignStatus, MemberStage stage, DisplayStage displayStage,
                                 int deliverables, int posted, boolean removable) {

    static InfluencerCampaign from(Campaign c, CampaignMember m) {
        return new InfluencerCampaign(c.getId(), c.getName(), c.getBrand(), c.getStartDate(), c.getEndDate(),
                c.getStatus(), m.getStage(), m.displayStage(), m.getDeliverables().size(),
                (int) m.getDeliverables().stream().filter(d -> d.getStatus() == DeliverableStatus.POSTED).count(),
                m.getStage() == MemberStage.SHORTLISTED && m.canBeRemoved());
    }
}
