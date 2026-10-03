package com.influenceiq.crm.influencer.search;

import java.util.List;

/** One page of results, in the same shape as the UI's paginate() (frontend/src/lib/paginate.ts). */
public record SearchPage<T>(List<T> items, int page, int size, long total, int totalPages) {

    public static <T> SearchPage<T> of(List<T> items, int page, int size, long total) {
        return new SearchPage<>(items, page, size, total, (int) Math.max(1, (total + size - 1) / size));
    }
}
