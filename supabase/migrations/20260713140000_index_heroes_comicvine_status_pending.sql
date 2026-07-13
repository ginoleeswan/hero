-- Partial index on heroes.comicvine_status = 'pending'.
--
-- Why: the ComicVine enrichment drain (and the command-center count HEAD
-- request `/heroes?comicvine_status=eq.pending`) filter on comicvine_status,
-- which was unindexed. EXPLAIN (ANALYZE, BUFFERS) on the hot form:
--   select id from heroes where comicvine_status = 'pending' limit 200;
-- was a Seq Scan — 1424 ms *fully cached* (Rows Removed by Filter: 15817),
-- and was returning 500s in the API logs under disk-IO pressure (the scan
-- can't complete against the throttled baseline IO once the burst budget is
-- spent). This is one of the queries that was timing the app out.
--
-- What: a PARTIAL index on just the 'pending' rows (5,848 of ~50k, and
-- shrinking as the drain completes → done). Tiny footprint (<1 MB, important
-- while the DB is near the free-tier 500 MB cap) and it doesn't index the bulk
-- 'done' rows we never scan for. Turns the drain/count scans into index scans.
--
-- Not CONCURRENTLY: migrations run in a transaction; the build on 50k rows is
-- sub-second. The cron write-pressure was already cut by the two preceding
-- migrations, so the brief SHARE lock is inexpensive.

create index if not exists heroes_comicvine_status_pending_idx
  on public.heroes (comicvine_status)
  where comicvine_status = 'pending';
