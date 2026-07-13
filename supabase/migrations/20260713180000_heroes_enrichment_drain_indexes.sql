-- Partial indexes for the enrichment-drain "find the next N rows needing work"
-- queries. Each drain ran `WHERE <predicate> ORDER BY <priority> LIMIT N` with no
-- supporting index, so every run sequentially scanned all ~50k heroes — the top
-- background disk-IO consumers on the free tier, and getting slower as the
-- catalogue grows / each backlog drains toward empty (more rows to skip to find N).
-- Same failure class as the O(N^2) teammate self-join, spread across the pipeline.
--
-- The predicates match only the pending subset, so these indexes stay tiny (two of
-- the three are ~empty today — the drains are caught up) yet turn multi-second
-- scans into sub-millisecond index scans, and auto-handle future backlog as new
-- heroes arrive. Verified with EXPLAIN ANALYZE:
--   wiki-pageviews  : 9,537 ms -> 27 ms   (every 2h; live 3,836-hero cycle)
--   enwiki-resolve  : 15,018 ms -> 0.05 ms (every 6h; backlog 0)
--   wikidata-enrich : ~880 ms  -> instant  (every 6h; backlog 0)
--
-- Live indexes were built CONCURRENTLY (non-blocking on the actively-written heroes
-- table); this file uses plain CREATE INDEX IF NOT EXISTS so it is a no-op against
-- the existing indexes and replays cleanly on a fresh database.

-- wiki-pageviews-cycle: SELECT ... WHERE enwiki_title is not null and enwiki_title <> ''
--   ORDER BY pageviews_at asc nulls first  (refresh stalest-pageviews heroes first)
create index if not exists heroes_wiki_pageviews_queue
  on public.heroes (pageviews_at asc nulls first)
  where enwiki_title is not null and enwiki_title <> '';

-- resolve-enwiki-title-drain: SELECT ... WHERE wikidata_qid is not null and enwiki_title is null
--   ORDER BY fame_score desc nulls last
create index if not exists heroes_enwiki_resolve_queue
  on public.heroes (fame_score desc nulls last)
  where wikidata_qid is not null and enwiki_title is null;

-- enrich-wikidata-pending: SELECT ... WHERE wikidata_status = $1 and wikidata_qid is not null
--   and wikidata_enriched_at is null ORDER BY issue_count desc nulls last.
--   Status is left as a residual filter so the index works for any status value.
create index if not exists heroes_wikidata_enrich_queue
  on public.heroes (issue_count desc nulls last)
  where wikidata_qid is not null and wikidata_enriched_at is null;
