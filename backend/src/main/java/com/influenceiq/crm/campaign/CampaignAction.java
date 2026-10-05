package com.influenceiq.crm.campaign;

import java.util.Set;

/** What people can do to a campaign's status (docs/DATA_MODEL.md, "Campaign" state machine). */
public enum CampaignAction {
    ACTIVATE("activate", false, Set.of(CampaignStatus.DRAFT)),
    COMPLETE("mark completed", false, Set.of(CampaignStatus.ACTIVE)),
    CANCEL("cancel", true, Set.of(CampaignStatus.DRAFT, CampaignStatus.ACTIVE)),
    REOPEN("reopen", true, Set.of(CampaignStatus.COMPLETED, CampaignStatus.CANCELLED)),
    ARCHIVE("archive", false, Set.of(CampaignStatus.COMPLETED, CampaignStatus.CANCELLED)),
    UNARCHIVE("unarchive", true, Set.of(CampaignStatus.ARCHIVED));

    final String label;
    /** Must record why (stored as the campaign's latest status reason). */
    final boolean needsReason;
    /** The statuses this action can start from. */
    final Set<CampaignStatus> from;

    CampaignAction(String label, boolean needsReason, Set<CampaignStatus> from) {
        this.label = label;
        this.needsReason = needsReason;
        this.from = from;
    }
}
