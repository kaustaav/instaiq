package com.influenceiq.crm.campaign;

/** AWAITING_DRAFT -> IN_REVIEW -> APPROVED -> POSTED, with CHANGES_REQUESTED <-> IN_REVIEW rounds in between. */
public enum DeliverableStatus {
    AWAITING_DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, POSTED
}
