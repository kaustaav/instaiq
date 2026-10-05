package com.influenceiq.crm.campaign;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {

    /**
     * Load for a change. OPTIMISTIC_FORCE_INCREMENT bumps the campaign's version at commit even when only a
     * member row changed, so two people changing the same campaign at once can't both win: the second gets 409.
     */
    @Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)
    Optional<Campaign> findForUpdateById(long id);

    boolean existsByNameAndBrand(String name, String brand);

    /** Newest first, members loaded in the same query (no query per campaign). */
    @EntityGraph(attributePaths = "members")
    List<Campaign> findAllByOrderByIdDesc();

    /** Every campaign the influencer is in, newest first (profile "Campaign history", the add-to-campaign popup). */
    @EntityGraph(attributePaths = "members")
    @Query("SELECT DISTINCT c FROM Campaign c JOIN c.members m WHERE m.influencerId = :influencerId ORDER BY c.id DESC")
    List<Campaign> findAllWithInfluencer(long influencerId);
}
