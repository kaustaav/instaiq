package com.influenceiq.crm.demo;

import com.influenceiq.crm.campaign.CampaignAction;
import com.influenceiq.crm.campaign.CampaignDetails;
import com.influenceiq.crm.campaign.CampaignRepository;
import com.influenceiq.crm.campaign.CampaignService;
import com.influenceiq.crm.campaign.CampaignService.Terms;
import com.influenceiq.crm.campaign.CampaignStatus;
import com.influenceiq.crm.campaign.DeliverableType;
import com.influenceiq.crm.campaign.MemberStage;
import com.influenceiq.crm.campaign.api.CampaignQueryService;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRepository;
import com.influenceiq.crm.influencer.InstagramHandle;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Loads the demo campaigns (src/main/resources/demo/campaigns.json) by replaying each one through CampaignService,
 * the same path the API uses: add members, move stages, agree terms, submit/review/post drafts, pay, then
 * activate/complete/cancel/archive. So demo data can't break a rule (a bad file fails loudly instead).
 * Run by DemoDataLoader after the influencers exist.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true")
class DemoCampaignLoader {

    private final CampaignService campaigns;
    private final CampaignRepository campaignRepository;
    private final CampaignQueryService queries;
    private final InfluencerRepository influencers;
    private final JsonMapper json;

    void load() throws IOException {
        List<DemoCampaign> rows;
        try (InputStream in = new ClassPathResource("demo/campaigns.json").getInputStream()) {
            rows = json.readValue(in, new TypeReference<>() {});
        }
        // a database can already hold real or test campaigns; only the demo set itself means "already loaded"
        DemoCampaign first = rows.getFirst();
        if (campaignRepository.existsByNameAndBrand(first.name(), first.brand())) {
            log.info("Demo campaigns: skipped, \"{}\" already exists", first.name());
            return;
        }
        int loaded = 0;
        for (DemoCampaign row : rows) {
            try {
                replay(row);
                loaded++;
            } catch (RuntimeException e) {
                log.warn("Demo campaigns: \"{}\" stopped part-way: {}", row.name(), e.getMessage());
            }
        }
        log.info("Demo campaigns: loaded {} of {}", loaded, rows.size());
    }

    private void replay(DemoCampaign c) {
        String actor = DemoDataLoader.ACTOR;
        long id = campaigns.create(new CampaignDetails(c.name(), c.brand(), c.brief(), c.startDate(), c.endDate(),
                c.budgetInr(), c.targetInfluencers(), c.targetReels(), c.targetStories(), c.targetPosts()), actor).getId();

        for (DemoCampaign.Member m : c.members()) {
            long inf = influencerId(m.handle());
            campaigns.addMembers(id, List.of(inf), actor);
            if (m.stage() == MemberStage.DECLINED) {
                campaigns.moveMember(id, inf, MemberStage.DECLINED, m.stageReason(), actor);
            } else {
                replayStages(id, inf, m, actor);
            }
            if (m.notes() != null) campaigns.updateMemberNotes(id, inf, m.notes());
        }

        // status last: completed/cancelled/archived campaigns are read-only
        switch (c.status()) {
            case DRAFT -> { }
            case ACTIVE -> campaigns.changeStatus(id, CampaignAction.ACTIVATE, null, actor);
            case CANCELLED -> campaigns.changeStatus(id, CampaignAction.CANCEL, c.statusReason(), actor);
            case COMPLETED, ARCHIVED -> {
                campaigns.changeStatus(id, CampaignAction.ACTIVATE, null, actor);
                campaigns.changeStatus(id, CampaignAction.COMPLETE, null, actor);
                if (c.status() == CampaignStatus.ARCHIVED) campaigns.changeStatus(id, CampaignAction.ARCHIVE, null, actor);
            }
        }
    }

    /** SHORTLISTED -> CONTACTED -> NEGOTIATING -> AGREED, then content and money, as far as the member got. */
    private void replayStages(long id, long inf, DemoCampaign.Member m, String actor) {
        List<MemberStage> path = List.of(MemberStage.CONTACTED, MemberStage.NEGOTIATING);
        for (MemberStage step : path) {
            if (m.stage().ordinal() < step.ordinal()) return;
            campaigns.moveMember(id, inf, step, null, actor);
        }
        if (m.stage() != MemberStage.AGREED) return;

        campaigns.agreeTerms(id, inf, new Terms(m.compensation(), m.feeInr(), count(m, DeliverableType.REEL),
                count(m, DeliverableType.STORY), count(m, DeliverableType.POST)), actor);
        for (DemoCampaign.Deliverable d : m.deliverables()) {
            long deliverableId = deliverableId(id, inf, d);
            for (DemoCampaign.Revision r : d.revisions()) {
                campaigns.submitDraft(id, inf, deliverableId, r.draftUrl(), actor);
                if (r.decision() != null) campaigns.reviewDraft(id, inf, deliverableId, r.decision(), r.feedback(), actor);
            }
            if (d.liveUrl() != null) campaigns.markPosted(id, inf, deliverableId, d.liveUrl(), d.postedAt());
        }
        for (DemoCampaign.Payment p : m.payments()) {
            campaigns.recordPayment(id, inf, p.amountInr(), p.paidAt(), p.receiptUrl(), actor);
        }
        if (m.paymentWriteOffReason() != null) campaigns.writeOffPayment(id, inf, m.paymentWriteOffReason());
    }

    private static int count(DemoCampaign.Member m, DeliverableType type) {
        return (int) m.deliverables().stream().filter(d -> d.type() == type).count();
    }

    /** The deliverable agreeing terms created for this type + number ("Reel 2"). */
    private long deliverableId(long campaignId, long influencerId, DemoCampaign.Deliverable d) {
        return queries.get(campaignId).members().stream()
                .filter(m -> m.influencer().id() == influencerId)
                .flatMap(m -> m.deliverables().stream())
                .filter(x -> x.type() == d.type() && x.seq() == d.seq())
                .findFirst().orElseThrow().id();
    }

    private long influencerId(String handle) {
        return influencers.findByHandle(InstagramHandle.parse(handle)).map(Influencer::getId)
                .orElseThrow(() -> new IllegalStateException("No demo influencer @" + handle));
    }
}
