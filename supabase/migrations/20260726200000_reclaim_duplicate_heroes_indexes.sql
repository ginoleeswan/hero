-- Reclaim ~20MB on the 500MB free-tier cap. The DB hit 489.97MB (grace period
-- over → requests start failing at the cap). The growth since the 2026-07-13
-- trim (437MB → 476MB) was almost entirely NEW INDEXES on heroes — 49MB → 90MB
-- across the perf-audit sprint — not data. Four objects are provable waste:
-- dropping them is behaviour-neutral, and each is one CREATE away from reversal.

-- 1+2. Exact duplicate trigram GINs.
-- 20260715105637_trigram_indexes_browse_filters.sql added name/full_name GINs
-- under NEW names, so its `if not exists` guards never fired against the
-- already-present `_idx`-suffixed originals. Both pairs are byte-identical
-- (gin (col) gin_trgm_ops), and the planner has been feeding the originals:
--   heroes_name_trgm_idx      25,855 scans   vs  heroes_name_trgm        61 scans
--   heroes_full_name_trgm_idx     49 scans   vs  heroes_full_name_trgm    5 scans
-- Keep the originals (the ones with the traffic); drop the 2026-07-15 copies.
-- The browse-filter ILIKE paths that migration was written for keep their index
-- quals — they were always resolving through the originals.
drop index if exists public.heroes_name_trgm;        -- 8.4 MB
drop index if exists public.heroes_full_name_trgm;   -- 1.7 MB

-- 3. Redundant covering index superseded two days after it was created.
-- 20260714142827_speed_up_enrichment_progress.sql built:
--     (comicvine_status, wikidata_status) include (wikidata_enriched_at)
-- then 20260716140000_admin_metrics_perf.sql built a strict superset:
--     (comicvine_status, wikidata_status) include (superhero_api_id,
--      comicvine_id, wikidata_qid, wikidata_enriched_at)
-- Same key columns, same order; the newer INCLUDE list contains the older one.
-- heroes_source_cov_idx therefore still serves enrichment_progress() as an
-- index-only scan — marginally wider pages, still no heap read, still nowhere
-- near the 197MB seq scan that migration was killing.
drop index if exists public.heroes_enrichment_counts_idx;  -- 6.3 MB

-- 4. Stale snapshot table. A 34,006-row metadata backup taken 2026-06-29 to
-- guard a bulk operation that has long since settled. Read by nothing in the
-- app — its only repo mention is the auto-generated types file, which gets
-- regenerated after this migration.
drop table if exists public.heroes_meta_backup_20260629;    -- 3.5 MB
