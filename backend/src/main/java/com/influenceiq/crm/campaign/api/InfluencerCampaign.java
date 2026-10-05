package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.Campaign;
import com.influenceiq.crm.campaign.CampaignMember;
import com.influenceiq.crm.campaign.CampaignStatus;
import com.influenceiq.crm.campaign.DisplayStage;
import com.influenceiq.crm.campaign.MemberStage;
import java.time.LocalDate;

/** One campaign an influencer is in, with where they are in it. */
public record InfluencerCampaign(long campaignId, String name, String brand, LocalDate startDate, LocalDate endDate,
                                 CampaignStatus campaignStatus, MemberStage stage, DisplayStage displayStage) {

    static InfluencerCampaign from(Campaign c, CampaignMember m) {
        return new InfluencerCampaign(c.getId(), c.getName(), c.getBrand(), c.getStartDate(), c.getEndDate(),
                c.getStatus(), m.getStage(), m.displayStage());
    }
}
