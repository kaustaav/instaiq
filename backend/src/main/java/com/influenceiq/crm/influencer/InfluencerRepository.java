package com.influenceiq.crm.influencer;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data generates the implementation at startup: save, findById, findAll, delete... come from
 * JpaRepository, and methods like findByHandle are turned into SQL from their names.
 */
public interface InfluencerRepository extends JpaRepository<Influencer, Long> {

    /** Takes an InstagramHandle, so callers can't search with an un-normalized string by mistake. */
    Optional<Influencer> findByHandle(InstagramHandle handle);

    boolean existsByHandle(InstagramHandle handle);
}
