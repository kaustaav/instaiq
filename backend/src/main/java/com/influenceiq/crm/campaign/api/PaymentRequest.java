package com.influenceiq.crm.campaign.api;

import java.time.LocalDate;

/** Body of POST /api/campaigns/{id}/members/{influencerId}/payments. */
public record PaymentRequest(Integer amountInr, LocalDate paidAt, String receiptUrl) {
}
