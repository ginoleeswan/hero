-- Enrichment-funnel counts for the Build ("Pipelines") domain, in ONE round trip.
-- Replaces 11 parallel client-side `count: 'exact'` head queries whose intermittent
-- statement-timeouts were silently swallowed (count -> null -> 0), corrupting the
-- funnel with false zeros ("sometimes the numbers aren't accurate"). Two scans —
-- one over heroes, one over titles — via FILTER, so it can't partially fail.
-- SECURITY INVOKER honours public-read RLS; the screen is admin-gated client-side.
create or replace function enrichment_progress()
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'heroesTotal',        (select count(*) from heroes),
    'comicvineDone',      (select count(*) from heroes where comicvine_status = 'done'),
    'comicvineUnmatched', (select count(*) from heroes where comicvine_status = 'unmatched'),
    'resolved',           (select count(*) from heroes where wikidata_status = 'resolved'),
    'ambiguous',          (select count(*) from heroes where wikidata_status = 'ambiguous'),
    'unresolved',         (select count(*) from heroes where wikidata_status = 'unresolved'),
    'enriched',           (select count(*) from heroes
                             where wikidata_status = 'resolved'
                               and wikidata_enriched_at is not null),
    'filmTitles',         (select count(*) from titles where media_type = 'film'),
    'tvTitles',           (select count(*) from titles where media_type = 'tv'),
    'gameTitles',         (select count(*) from titles where media_type = 'game'),
    'mediaDone',          (select count(*) from titles
                             where source = 'tmdb' and enrich_status = 'done')
  );
$$;
