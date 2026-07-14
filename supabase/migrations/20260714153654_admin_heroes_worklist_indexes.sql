-- Speed up the admin Build + Catalog tabs. Each fired heroes queries that cold
-- seq-scanned the 197MB heap (~2-4s): getPendingPortraitCount (3.68s),
-- getPendingStatsCount, and getCoverageGaps (portrait/summary/first_issue, the
-- Catalog default sub). Partial indexes matching each predicate turn them into
-- index-only scans of the small pending sets (portrait_pending 3.68s -> 83ms,
-- coverage_portrait -> ~2ms). Overview's enrichment_progress + unbranded were
-- already fixed; Audience only touches small tables, which is why it was fast.

-- Build: portrait backlog count + getPendingPortraitIds list (fame-ordered).
create index if not exists heroes_portrait_pending_idx
  on public.heroes (fame_score desc nulls last)
  where portrait_url is null and image_url is not null;

-- Build: AI-stats backlog count.
create index if not exists heroes_stats_pending_idx
  on public.heroes (issue_count desc nulls last)
  where comicvine_status = 'done' and (ai_stats_status is null or ai_stats_status = 'pending');

-- Catalog: coverage-gap worklists (enriched heroes missing a field), issue_count-ordered.
create index if not exists heroes_gap_portrait_idx
  on public.heroes (issue_count desc nulls last)
  where enriched_at is not null and portrait_url is null;

create index if not exists heroes_gap_summary_idx
  on public.heroes (issue_count desc nulls last)
  where enriched_at is not null and summary is null;

create index if not exists heroes_gap_first_issue_idx
  on public.heroes (issue_count desc nulls last)
  where enriched_at is not null and first_issue_id is null;
