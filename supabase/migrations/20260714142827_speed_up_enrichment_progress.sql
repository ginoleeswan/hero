-- Speed up the admin command-center's slowest tile. enrichment_progress() ran
-- ELEVEN separate count(*) subqueries; the 6 status counts over heroes each did a
-- FULL sequential scan of the 197MB heroes heap — ~5s warm and ~13.5s cold (the
-- "sometimes takes long to load" the admin sees). Two fixes:
--   1. Single-pass FILTER aggregate: one scan of heroes instead of six.
--   2. A narrow covering index on the status columns so that single pass becomes
--      an index-only scan of a ~few-MB index instead of the 197MB heap — fast even
--      on a cold cache. Columns aren't in any hot write path beyond the enrichment
--      drains that already touch them.
-- Output shape is byte-identical; only the plan changes. Reversible: drop the index
-- and restore the previous 11-subquery body.

create index if not exists heroes_enrichment_counts_idx
  on public.heroes (comicvine_status, wikidata_status) include (wikidata_enriched_at);

create or replace function public.enrichment_progress()
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  with h as (
    select
      count(*)                                                                             as total,
      count(*) filter (where comicvine_status = 'done')                                    as cv_done,
      count(*) filter (where comicvine_status = 'unmatched')                               as cv_unmatched,
      count(*) filter (where wikidata_status = 'resolved')                                 as resolved,
      count(*) filter (where wikidata_status = 'ambiguous')                                as ambiguous,
      count(*) filter (where wikidata_status = 'unresolved')                               as unresolved,
      count(*) filter (where wikidata_status = 'resolved' and wikidata_enriched_at is not null) as enriched
    from heroes
  ),
  t as (
    select
      count(*) filter (where media_type = 'film')                        as film,
      count(*) filter (where media_type = 'tv')                          as tv,
      count(*) filter (where media_type = 'game')                        as game,
      count(*) filter (where source = 'tmdb' and enrich_status = 'done') as media_done
    from titles
  )
  select jsonb_build_object(
    'heroesTotal',        h.total,
    'comicvineDone',      h.cv_done,
    'comicvineUnmatched', h.cv_unmatched,
    'resolved',           h.resolved,
    'ambiguous',          h.ambiguous,
    'unresolved',         h.unresolved,
    'enriched',           h.enriched,
    'filmTitles',         t.film,
    'tvTitles',           t.tv,
    'gameTitles',         t.game,
    'mediaDone',          t.media_done
  )
  from h, t;
$function$;
