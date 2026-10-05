package com.influenceiq.crm.campaign.api;

/** Body of POST .../deliverables/{deliverableId}/drafts: a link to the draft (e.g. a Google Drive file). */
public record DraftRequest(String draftUrl) {
}
