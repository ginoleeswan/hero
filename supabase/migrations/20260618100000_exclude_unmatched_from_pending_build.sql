-- 'unmatched' is a terminal comicvine_status: ComicVine has no character by this
-- name (mantle aliases like "Venom III", or non-comic figures like "Jason
-- Bourne"). It is NOT an error and must leave the actionable backlog — otherwise
-- the build queue would re-run it forever. Exclude it alongside 'failed'.
CREATE OR REPLACE FUNCTION public.get_pending_build_ids(p_limit integer DEFAULT 25)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id
  from public.heroes
  where comicvine_status is distinct from 'failed'
    and comicvine_status is distinct from 'unmatched'
    and (
      comicvine_status is distinct from 'done'
      or (comicvine_status = 'done' and wikidata_status = 'pending')
      or (
        comicvine_status = 'done'
        and wikidata_status not in ('pending', 'ambiguous', 'unresolved')
        and wikidata_enriched_at is null
      )
    )
  order by issue_count desc nulls last
  limit greatest(p_limit, 0);
$function$;
