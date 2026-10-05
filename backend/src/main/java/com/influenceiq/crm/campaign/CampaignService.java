package com.influenceiq.crm.campaign;

import com.influenceiq.crm.common.ConflictException;
import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRepository;
import com.influenceiq.crm.influencer.InfluencerStatus;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.LongFunction;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Campaign writes. Rules live in Campaign/CampaignMember; this class loads, checks across aggregates, and saves. */
@Service
@RequiredArgsConstructor
@Transactional
public class CampaignService {

    /** Same cap as "Add all" on search (InfluencerSearchService.MAX_IDS). */
    static final int MAX_ADD = 5000;

    private final CampaignRepository campaigns;
    private final InfluencerRepository influencers;

    public Campaign create(CampaignDetails details, String actor) {
        return campaigns.save(new Campaign(details, actor));
    }

    public Campaign update(long id, int expectedVersion, CampaignDetails details) {
        Campaign c = loadForUpdate(id);
        if (c.getVersion() != expectedVersion) {
            throw new ConflictException("This campaign was changed by someone else. Reload and try again.");
        }
        c.updateDetails(details);
        return c;
    }

    /** Same setup (name, brand, brief, budget, targets), no dates, empty pipeline, starts as DRAFT. */
    public Campaign duplicate(long id, String actor) {
        Campaign src = campaigns.findById(id).orElseThrow(() -> new NotFoundException("Campaign", id));
        return create(new CampaignDetails(src.getName() + " (copy)", src.getBrand(), src.getBrief(), null, null,
                src.getBudgetInr(), src.getTargetInfluencers(), src.getTargetReels(), src.getTargetStories(),
                src.getTargetPosts()), actor);
    }

    /** One influencer that couldn't be added, and why. */
    public record NotAdded(long influencerId, String name, String reason) {}

    /**
     * @param onHold added, but worth a second look (ON_HOLD influencers)
     */
    public record AddResult(int added, int alreadyIn, List<NotAdded> notAdded, List<String> onHold) {}

    /** Adds what it can: already-present ones are skipped, banned/archived/unknown ones are reported, not added. */
    public AddResult addMembers(long campaignId, List<Long> influencerIds, String actor) {
        if (influencerIds == null || influencerIds.isEmpty()) throw new ValidationException("Pick at least one influencer");
        if (influencerIds.size() > MAX_ADD) throw new ValidationException("At most " + MAX_ADD + " influencers at a time");
        Campaign c = loadForUpdate(campaignId);
        Map<Long, Influencer> found = influencers.findAllById(influencerIds).stream()
                .collect(Collectors.toMap(Influencer::getId, Function.identity()));

        int added = 0;
        int alreadyIn = 0;
        List<NotAdded> notAdded = new ArrayList<>();
        List<String> onHold = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(influencerIds)) { // de-duplicated, order kept
            Influencer i = found.get(id);
            if (i == null) {
                notAdded.add(new NotAdded(id, null, "Influencer not found"));
            } else if (i.getStatus() == InfluencerStatus.BANNED || i.getStatus() == InfluencerStatus.ARCHIVED) {
                notAdded.add(new NotAdded(id, i.getName(), "Influencer is " + i.getStatus().name().toLowerCase()));
            } else if (!c.addMember(id, actor)) {
                alreadyIn++;
            } else {
                added++;
                if (i.getStatus() == InfluencerStatus.ON_HOLD) onHold.add(i.getName());
            }
        }
        return new AddResult(added, alreadyIn, notAdded, onHold);
    }

    public Campaign removeMember(long campaignId, long influencerId) {
        Campaign c = loadForUpdate(campaignId);
        c.removeMember(influencerId);
        return c;
    }

    public Campaign changeStatus(long id, CampaignAction action, String reason, String actor) {
        if (action == null) throw new ValidationException("action is required");
        Campaign c = loadForUpdate(id);
        c.changeStatus(action, reason, actor, namesOf(c));
        return c;
    }

    public Campaign moveMember(long campaignId, long influencerId, MemberStage to, String reason, String actor) {
        if (to == null) throw new ValidationException("stage is required");
        Campaign c = loadForUpdate(campaignId);
        c.moveMember(influencerId, to, reason, actor);
        return c;
    }

    public Campaign updateMemberNotes(long campaignId, long influencerId, String notes) {
        Campaign c = loadForUpdate(campaignId);
        c.updateMemberNotes(influencerId, notes);
        return c;
    }

    public record Terms(Compensation compensation, Integer feeInr, int reels, int stories, int posts) {}

    public Campaign agreeTerms(long campaignId, long influencerId, Terms t, String actor) {
        Campaign c = loadForUpdate(campaignId);
        c.agreeTerms(influencerId, t.compensation(), t.feeInr(), t.reels(), t.stories(), t.posts(), actor);
        return c;
    }

    public Campaign submitDraft(long campaignId, long influencerId, long deliverableId, String url, String actor) {
        Campaign c = loadForUpdate(campaignId);
        c.submitDraft(influencerId, deliverableId, url, actor);
        return c;
    }

    public Campaign reviewDraft(long campaignId, long influencerId, long deliverableId, ReviewDecision decision,
                                String feedback, String actor) {
        Campaign c = loadForUpdate(campaignId);
        c.reviewDraft(influencerId, deliverableId, decision, feedback, actor);
        return c;
    }

    public Campaign markPosted(long campaignId, long influencerId, long deliverableId, String url, LocalDate postedAt) {
        Campaign c = loadForUpdate(campaignId);
        c.markPosted(influencerId, deliverableId, url, postedAt);
        return c;
    }

    /** Member names for rule messages ("Priya Sharma: still shortlisted"), one query for all members. */
    private LongFunction<String> namesOf(Campaign c) {
        Map<Long, String> names = influencers.findAllById(c.getMembers().stream().map(CampaignMember::getInfluencerId).toList())
                .stream().collect(Collectors.toMap(Influencer::getId, Influencer::getName));
        return id -> names.getOrDefault(id, "Influencer #" + id);
    }

    private Campaign loadForUpdate(long id) {
        return campaigns.findForUpdateById(id).orElseThrow(() -> new NotFoundException("Campaign", id));
    }
}
