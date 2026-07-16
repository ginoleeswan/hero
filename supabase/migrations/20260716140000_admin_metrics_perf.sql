-- Admin-metrics refresh perf: kill the 15s (44s peak) refresh_admin_metrics()
-- cron that ran every 5 min and full-scanned the 106MB heroes heap for counts,
-- starving interactive dashboard queries (3s statement timeout) → the "database
-- may be busy" LoadFailed screen. Two covering indexes turn the two hot compute
-- functions into index-only scans, and compute_get_source_coverage becomes a
-- single pass instead of 17 subqueries.
--
--   compute_catalog_health       7.3s → ~0.03s   (partial index, 4.5k enriched rows)
--   compute_get_source_coverage  8.6s → ~0.3s    (covering index + single pass)
--
-- Indexes were first built in prod with CREATE INDEX CONCURRENTLY (no lock);
-- these IF NOT EXISTS forms are no-ops there and set up a fresh DB correctly.
-- The cron cadence change (5min → 20min) is an operational cron.alter_job made
-- out of band — it isn't schema and doesn't belong in a versioned migration.

-- Covering index for compute_get_source_coverage's whole-catalogue counts and
-- catalog_health's comicvine_status group-by → index-only scans, no heap read.
create index if not exists heroes_source_cov_idx
  on public.heroes (comicvine_status, wikidata_status)
  include (superhero_api_id, comicvine_id, wikidata_qid, wikidata_enriched_at);

-- Partial covering index for catalog_health's per-metric + by-publisher aggregate
-- over the ~4.5k enriched heroes (vs seq-scanning all 50k). Boolean expressions
-- match the function body exactly so the scan stays index-only (never touches the
-- fat summary/portrait/image text columns on the heap).
create index if not exists heroes_health_enriched_idx
  on public.heroes (
    publisher,
    (portrait_url is not null),
    (image_url is not null),
    (intelligence is not null),
    (summary is not null),
    (first_issue_id is not null)
  )
  where enriched_at is not null;

-- Single-pass rewrite: one index-only scan of heroes with count(*) filter (...)
-- instead of 10 separate `select count(*) from heroes where ...` subqueries.
-- Output is byte-identical to the previous definition.
create or replace function public.compute_get_source_coverage()
  returns json
  language sql
  stable
  set search_path to 'public'
as $function$
  select json_build_object(
    'total', h.total,
    'superhero_api', json_build_object('linked', h.sa_linked),
    'comicvine', json_build_object(
      'linked',  h.cv_linked,
      'done',    h.cv_done,
      'pending', h.cv_pending,
      'failed',  h.cv_failed
    ),
    'wikidata', json_build_object(
      'resolved',   h.wd_resolved,
      'ambiguous',  h.wd_ambiguous,
      'unresolved', h.wd_unresolved,
      'enriched',   h.wd_enriched
    ),
    'tmdb', json_build_object(
      'titles',   t.titles,
      'enriched', t.enriched,
      'films',    t.films,
      'tv',       t.tv
    )
  )
  from (
    select
      count(*)                                                as total,
      count(*) filter (where superhero_api_id is not null)    as sa_linked,
      count(*) filter (where comicvine_id is not null)        as cv_linked,
      count(*) filter (where comicvine_status = 'done')       as cv_done,
      count(*) filter (where comicvine_status = 'pending')    as cv_pending,
      count(*) filter (where comicvine_status = 'failed')     as cv_failed,
      count(*) filter (where wikidata_qid is not null)        as wd_resolved,
      count(*) filter (where wikidata_status = 'ambiguous')   as wd_ambiguous,
      count(*) filter (where wikidata_status = 'unresolved')  as wd_unresolved,
      count(*) filter (where wikidata_enriched_at is not null) as wd_enriched
    from heroes
  ) h,
  (
    select
      count(*)                                          as titles,
      count(*) filter (where enriched_at is not null)   as enriched,
      count(*) filter (where media_type = 'film')       as films,
      count(*) filter (where media_type = 'tv')         as tv
    from titles
  ) t;
$function$;
