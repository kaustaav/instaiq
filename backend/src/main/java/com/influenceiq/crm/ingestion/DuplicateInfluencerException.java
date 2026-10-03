package com.influenceiq.crm.ingestion;

import com.influenceiq.crm.influencer.InstagramHandle;
import lombok.Getter;

/** The handle already exists. The API will turn this into HTTP 409 and link to the existing profile. */
@Getter
public class DuplicateInfluencerException extends RuntimeException {

    private final InstagramHandle handle;
    private final Long existingId;

    public DuplicateInfluencerException(InstagramHandle handle, Long existingId) {
        super(handle + " already exists (influencer " + existingId + ")");
        this.handle = handle;
        this.existingId = existingId;
    }
}
