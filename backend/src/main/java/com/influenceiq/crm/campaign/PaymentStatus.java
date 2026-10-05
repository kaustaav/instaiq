package com.influenceiq.crm.campaign;

/** NOT_DUE until terms are agreed; then DUE -> PARTIALLY_PAID -> PAID, or WAIVED (barter, or written off). */
public enum PaymentStatus {
    NOT_DUE, DUE, PARTIALLY_PAID, PAID, WAIVED
}
