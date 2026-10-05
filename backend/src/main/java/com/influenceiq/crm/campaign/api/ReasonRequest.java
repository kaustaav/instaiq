package com.influenceiq.crm.campaign.api;

/** A body that only carries a reason (e.g. writing off a payment). */
public record ReasonRequest(String reason) {
}
