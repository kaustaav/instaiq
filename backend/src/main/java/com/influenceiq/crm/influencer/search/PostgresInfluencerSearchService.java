package com.influenceiq.crm.influencer.search;

import com.influenceiq.crm.influencer.InfluencerStatus;
import com.influenceiq.crm.influencer.search.SearchCriteria.LocationFilter;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Search with plain SQL (JdbcClient): Postgres full-text search, array overlap and trigram matching are clearer in
 * SQL than through JPA. Every value from the user is a bound parameter (":name"), never pasted into the SQL text,
 * so SQL injection isn't possible. Only fixed SQL fragments are concatenated.
 */
@Service
@RequiredArgsConstructor
public class PostgresInfluencerSearchService implements InfluencerSearchService {

    private final JdbcClient jdbc;

    @Override
    @Transactional(readOnly = true) // the count and the page see the same data
    public SearchPage<InfluencerSummary> search(SearchCriteria c) {
        Map<String, Object> params = new HashMap<>();
        String where = whereClause(c, params);

        long total = jdbc.sql("SELECT count(*) FROM influencer i WHERE " + where)
                .params(params)
                .query(Long.class)
                .single();

        // Relevance when searching text; otherwise a stable order so pages don't shuffle between requests.
        String orderBy = c.q() == null ? "i.id" : "rank DESC, i.id";
        String rank = c.q() == null ? "0" : "ts_rank(i.search_vector, websearch_to_tsquery('english', :q))"
                + (params.containsKey("prefix") ? " + ts_rank(i.search_vector, to_tsquery('simple', :prefix))" : "")
                + " + CASE WHEN i.handle::text ILIKE :like OR i.name ILIKE :like THEN 1 ELSE 0 END";

        params.put("limit", c.size());
        params.put("offset", (c.page() - 1) * c.size());
        List<InfluencerSummary> items = jdbc.sql("""
                        SELECT i.id, i.handle, i.name, i.cities, i.states, i.categories, i.languages, i.hashtags,
                               i.followers, i.engagement_rate, i.avg_likes, i.metrics_updated_at, i.status,
                               rc.reel_inr, %s AS rank
                        FROM influencer i
                        -- current rate card = newest effective_from (one row per influencer)
                        LEFT JOIN LATERAL (
                            SELECT r.reel_inr FROM influencer_rate_card r
                            WHERE r.influencer_id = i.id ORDER BY r.effective_from DESC LIMIT 1
                        ) rc ON true
                        WHERE %s
                        ORDER BY %s
                        LIMIT :limit OFFSET :offset""".formatted(rank, where, orderBy))
                .params(params)
                .query(this::toSummary)
                .list();

        return SearchPage.of(items, c.page(), c.size(), total);
    }

    /** Builds "a AND b AND ..." from fixed fragments; values go into params. */
    private static String whereClause(SearchCriteria c, Map<String, Object> params) {
        List<String> and = new ArrayList<>();

        and.add("i.status = ANY(CAST(:statuses AS text[]))");
        params.put("statuses", c.statuses().stream().map(InfluencerStatus::name).toArray(String[]::new));

        if (c.q() != null) {
            // 1) stemmed words ("handcrafted" finds "handcraft"), 2) word prefixes ("bridal" finds #bridaljewellery),
            // 3) plain substring on name / handle / hashtags ("jewel" finds @priyajewels and #finejewellery)
            String prefix = prefixQuery(c.q());
            List<String> or = new ArrayList<>();
            or.add("i.search_vector @@ websearch_to_tsquery('english', :q)");
            if (!prefix.isEmpty()) { // e.g. q = "!!!" has no words to prefix-match
                or.add("i.search_vector @@ to_tsquery('simple', :prefix)");
                params.put("prefix", prefix);
            }
            or.add("i.name ILIKE :like");
            or.add("i.handle::text ILIKE :like");
            or.add("join_words(i.hashtags) ILIKE :like"); // inside a tag: "jewel" finds #finejewellery
            and.add("(" + String.join(" OR ", or) + ")");
            params.put("q", c.q());
            params.put("like", "%" + escapeLike(c.q()) + "%");
        }

        if (!c.locations().isEmpty()) {
            // OR across all picked locations: in any picked city, or in any picked state
            String[] cities = names(c.locations(), LocationFilter.Type.CITY);
            String[] states = names(c.locations(), LocationFilter.Type.STATE);
            and.add("(i.cities && CAST(:cities AS text[]) OR i.states && CAST(:states AS text[]))");
            params.put("cities", cities);
            params.put("states", states);
        }
        if (!c.categories().isEmpty()) {
            and.add("i.categories && CAST(:categories AS text[])"); // && = "has any of" (uses the GIN index)
            params.put("categories", c.categories().toArray(String[]::new));
        }
        if (!c.languages().isEmpty()) {
            and.add("i.languages && CAST(:languages AS text[])");
            params.put("languages", c.languages().toArray(String[]::new));
        }
        if (c.followersMin() != null) {
            and.add("i.followers >= :fmin");
            params.put("fmin", c.followersMin());
        }
        if (c.followersMax() != null) {
            and.add("i.followers <= :fmax");
            params.put("fmax", c.followersMax());
        }
        if (c.minEngagementRate() != null) {
            and.add("i.engagement_rate >= :er");
            params.put("er", c.minEngagementRate());
        }
        return String.join(" AND ", and);
    }

    /** "bridal chandigarh" -> "bridal:* & chandigarh:*" (only letters/digits, so the tsquery syntax can't break). */
    static String prefixQuery(String q) {
        return Arrays.stream(q.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
                .filter(w -> !w.isEmpty())
                .map(w -> w + ":*")
                .collect(Collectors.joining(" & "));
    }

    /** Make %, _ and \ literal inside ILIKE. */
    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String[] names(List<LocationFilter> locations, LocationFilter.Type type) {
        return locations.stream().filter(l -> l.type() == type).map(LocationFilter::name).toArray(String[]::new);
    }

    private InfluencerSummary toSummary(ResultSet rs, int row) throws SQLException {
        Timestamp metricsAt = rs.getTimestamp("metrics_updated_at");
        return new InfluencerSummary(
                rs.getLong("id"), rs.getString("handle"), rs.getString("name"),
                list(rs.getArray("cities")), list(rs.getArray("states")), list(rs.getArray("categories")),
                list(rs.getArray("languages")), list(rs.getArray("hashtags")),
                rs.getInt("followers"), rs.getBigDecimal("engagement_rate"), (Integer) rs.getObject("avg_likes"),
                metricsAt == null ? null : metricsAt.toInstant(), InfluencerStatus.valueOf(rs.getString("status")),
                (Integer) rs.getObject("reel_inr"));
    }

    private static List<String> list(Array array) throws SQLException {
        return array == null ? List.of() : List.of((String[]) array.getArray());
    }
}
