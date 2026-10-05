package com.influenceiq.crm.campaign;

/** DRAFT -> ACTIVE -> COMPLETED; CANCELLED; ARCHIVED. COMPLETED, CANCELLED and ARCHIVED are read-only. */
public enum CampaignStatus {
    DRAFT, ACTIVE, COMPLETED, CANCELLED, ARCHIVED;

    public boolean isReadOnly() {
        return this == COMPLETED || this == CANCELLED || this == ARCHIVED;
    }
}
