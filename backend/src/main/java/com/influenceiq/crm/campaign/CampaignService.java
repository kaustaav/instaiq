package com.influenceiq.crm.campaign;

import com.influenceiq.crm.common.ConflictException;
import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.influencer.Influencer;
import com.influenceiq.crm.influencer.InfluencerRepository;
import com.influenceiq.crm.influencer.InfluencerStatus;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
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

    private Campaign loadForUpdate(long id) {
        return campaigns.findForUpdateById(id).orElseThrow(() -> new NotFoundException("Campaign", id));
    }
}
