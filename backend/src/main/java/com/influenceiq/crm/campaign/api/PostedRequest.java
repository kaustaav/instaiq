package com.influenceiq.crm.campaign.api;

import java.time.LocalDate;

/** Body of POST .../deliverables/{deliverableId}/posted: where it went live, and when ("2026-10-05"). */
public record PostedRequest(String liveUrl, LocalDate postedAt) {
}
