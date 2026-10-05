package com.influenceiq.crm.campaign.api;

import com.influenceiq.crm.campaign.Campaign;
import com.influenceiq.crm.campaign.CampaignService;
import com.influenceiq.crm.campaign.CampaignService.AddResult;
import com.influenceiq.crm.common.CurrentUser;
import com.influenceiq.crm.common.ValidationException;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** HTTP layer only; rules are in Campaign/CampaignService, errors become JSON in ApiExceptionHandler. */
@RestController
@RequestMapping("/api/campaigns")
@RequiredArgsConstructor
public class CampaignController {

    private final CampaignService campaigns;
    private final CampaignQueryService queries;
    private final CurrentUser currentUser;

    @GetMapping
    public List<CampaignSummary> list() {
        return queries.list();
    }

    @GetMapping("/{id}")
    public CampaignResponse get(@PathVariable long id) {
        return queries.get(id);
    }

    /** POST /api/campaigns -> 201, Location: /api/campaigns/{id}. New campaigns start as DRAFT. */
    @PostMapping
    public ResponseEntity<CampaignResponse> create(@RequestBody CampaignRequest body) {
        return created(campaigns.create(body.toDetails(), currentUser.name()));
    }

    /** Edit name/brand/brief/dates/budget. The body must carry the version the client loaded. */
    @PutMapping("/{id}")
    public CampaignResponse update(@PathVariable long id, @RequestBody CampaignRequest body) {
        if (body.version() == null) {
            throw new ValidationException("version is required (send back the version from GET)");
        }
        campaigns.update(id, body.version(), body.toDetails());
        return queries.get(id);
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<CampaignResponse> duplicate(@PathVariable long id) {
        return created(campaigns.duplicate(id, currentUser.name()));
    }

    /** Add influencers (skips ones already in; reports banned/archived ones instead of failing the whole batch). */
    @PostMapping("/{id}/members")
    public AddResult addMembers(@PathVariable long id, @RequestBody AddMembersRequest body) {
        return campaigns.addMembers(id, body.influencerIds(), currentUser.name());
    }

    @DeleteMapping("/{id}/members/{influencerId}")
    public CampaignResponse removeMember(@PathVariable long id, @PathVariable long influencerId) {
        campaigns.removeMember(id, influencerId);
        return queries.get(id);
    }

    /** Activate / complete / cancel / reopen / archive / unarchive. 409 lists everything in the way. */
    @PostMapping("/{id}/status")
    public CampaignResponse changeStatus(@PathVariable long id, @RequestBody StatusChangeRequest body) {
        campaigns.changeStatus(id, body.action(), body.reason(), currentUser.name());
        return queries.get(id);
    }

    @PutMapping("/{id}/members/{influencerId}/stage")
    public CampaignResponse moveMember(@PathVariable long id, @PathVariable long influencerId, @RequestBody StageRequest body) {
        campaigns.moveMember(id, influencerId, body.stage(), body.reason(), currentUser.name());
        return queries.get(id);
    }

    @PutMapping("/{id}/members/{influencerId}/notes")
    public CampaignResponse updateMemberNotes(@PathVariable long id, @PathVariable long influencerId,
                                              @RequestBody MemberNotesRequest body) {
        campaigns.updateMemberNotes(id, influencerId, body.notes());
        return queries.get(id);
    }

    /** NEGOTIATING -> AGREED: compensation, fee and how many reels/stories/posts (creates the deliverables). */
    @PostMapping("/{id}/members/{influencerId}/terms")
    public CampaignResponse agreeTerms(@PathVariable long id, @PathVariable long influencerId, @RequestBody TermsRequest body) {
        campaigns.agreeTerms(id, influencerId, body.toTerms(), currentUser.name());
        return queries.get(id);
    }

    @PostMapping("/{id}/members/{influencerId}/deliverables/{deliverableId}/drafts")
    public CampaignResponse submitDraft(@PathVariable long id, @PathVariable long influencerId, @PathVariable long deliverableId,
                                        @RequestBody DraftRequest body) {
        campaigns.submitDraft(id, influencerId, deliverableId, body.draftUrl(), currentUser.name());
        return queries.get(id);
    }

    @PostMapping("/{id}/members/{influencerId}/deliverables/{deliverableId}/review")
    public CampaignResponse reviewDraft(@PathVariable long id, @PathVariable long influencerId, @PathVariable long deliverableId,
                                        @RequestBody ReviewRequest body) {
        campaigns.reviewDraft(id, influencerId, deliverableId, body.decision(), body.feedback(), currentUser.name());
        return queries.get(id);
    }

    @PostMapping("/{id}/members/{influencerId}/deliverables/{deliverableId}/posted")
    public CampaignResponse markPosted(@PathVariable long id, @PathVariable long influencerId, @PathVariable long deliverableId,
                                       @RequestBody PostedRequest body) {
        campaigns.markPosted(id, influencerId, deliverableId, body.liveUrl(), body.postedAt());
        return queries.get(id);
    }

    /** Record one payment (amount, date, receipt link). Several are fine: advance, then the rest. */
    @PostMapping("/{id}/members/{influencerId}/payments")
    public CampaignResponse recordPayment(@PathVariable long id, @PathVariable long influencerId, @RequestBody PaymentRequest body) {
        campaigns.recordPayment(id, influencerId, body.amountInr(), body.paidAt(), body.receiptUrl(), currentUser.name());
        return queries.get(id);
    }

    @PostMapping("/{id}/members/{influencerId}/payments/write-off")
    public CampaignResponse writeOffPayment(@PathVariable long id, @PathVariable long influencerId, @RequestBody ReasonRequest body) {
        campaigns.writeOffPayment(id, influencerId, body.reason());
        return queries.get(id);
    }

    @PutMapping("/{id}/members/{influencerId}/fee")
    public CampaignResponse changeFee(@PathVariable long id, @PathVariable long influencerId, @RequestBody FeeRequest body) {
        campaigns.changeFee(id, influencerId, body.feeInr(), body.reason());
        return queries.get(id);
    }

    private ResponseEntity<CampaignResponse> created(Campaign c) {
        return ResponseEntity.created(URI.create("/api/campaigns/" + c.getId())).body(queries.get(c.getId()));
    }
}
