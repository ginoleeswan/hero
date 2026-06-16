-- Per-source coverage + health for the "Sources" view: how much of the catalogue
-- each external provider (SuperheroAPI → ComicVine → Wikidata → TMDB) accounts for.
create or replace function public.get_source_coverage()
returns json
language sql
stable
security invoker
set search_path = public
as $function$
  select json_build_object(
    'total', (select count(*) from heroes),
    'superhero_api', json_build_object(
      'linked', (select count(*) from heroes where superhero_api_id is not null)
    ),
    'comicvine', json_build_object(
      'linked',  (select count(*) from heroes where comicvine_id is not null),
      'done',    (select count(*) from heroes where comicvine_status = 'done'),
      'pending', (select count(*) from heroes where comicvine_status = 'pending'),
      'failed',  (select count(*) from heroes where comicvine_status = 'failed')
    ),
    'wikidata', json_build_object(
      'resolved',   (select count(*) from heroes where wikidata_qid is not null),
      'ambiguous',  (select count(*) from heroes where wikidata_status = 'ambiguous'),
      'unresolved', (select count(*) from heroes where wikidata_status = 'unresolved'),
      'enriched',   (select count(*) from heroes where wikidata_enriched_at is not null)
    ),
    'tmdb', json_build_object(
      'titles',   (select count(*) from titles),
      'enriched', (select count(*) from titles where enriched_at is not null),
      'films',    (select count(*) from titles where media_type = 'film'),
      'tv',       (select count(*) from titles where media_type = 'tv')
    )
  );
$function$;

grant execute on function public.get_source_coverage() to authenticated;
