-- Why the browse grids kept timing out on small publishers.
--
-- 20260715105637 added heroes_publisher_trgm and measured dark-horse at 5.2ms
-- as anon. In August the same page was returning HTTP 500 `canceling statement
-- due to statement timeout`. The index was still there and still healthy — what
-- had drifted was the STATISTICS.
--
-- `publisher` has 260 distinct values but the default statistics target keeps an
-- MCV list of only 68. Everything outside that list gets a guessed selectivity,
-- and once the catalog grew past ~50k rows the guess for
-- `publisher ILIKE '%dark horse%'` was high enough that the planner believed a
-- walk down heroes_fame_score_idx would fill LIMIT 48 early. It does not: only
-- 754 of 50,529 rows match, so it filtered 11,202 rows and burned 10,665 buffers
-- before the 3s anon statement_timeout killed it.
--
-- Measured, same query as anon, after a plain ANALYZE restored the estimate:
--   before  Index Scan heroes_fame_score_idx · 10665 buffers · 3046 ms (timeout)
--   after   Bitmap Index Scan heroes_publisher_trgm · 722 buffers · 7 ms
-- with the row estimate landing at 771 against an actual 754.
--
-- So the fix is to keep the estimate good rather than to add an index:
--
--   1. Raise the statistics target on publisher to 500 so the MCV list covers
--      ALL 260 publishers with headroom, instead of the top 68. This is what
--      makes the estimate near-exact for the long tail (Boom, Dynamite and the
--      other sub-10-hero imprints) rather than only for Marvel/DC/Image.
--   2. Analyze heroes at 2% drift instead of the default 10%. On a 50k table
--      that is ~1,000 modifications rather than ~5,100 — the enrichment drains
--      move more than that in a batch, and the last autoanalyze before this was
--      four days stale.
--
-- Deliberately NOT adding a (publisher, fame_score) btree. It only helps the
-- equality form, the winning ILIKE plan never touches it, and heroes already
-- carries 40 indexes — enough that planning this query costs 20-108ms on its
-- own. One more would cost every query a little to help none.

alter table public.heroes alter column publisher set statistics 500;

alter table public.heroes set (autovacuum_analyze_scale_factor = 0.02);

-- Investigation leftover from the session that produced this migration: a probe
-- index used to prove the equality form could be served at 20.6ms. The ILIKE
-- plan never used it, so it is pure overhead.
drop index if exists public.tmp_pub_fame_probe;

analyze public.heroes;
