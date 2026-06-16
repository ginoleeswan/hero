-- get_pending_build_ids: the next actionable heroes for the build pipeline,
-- most-published first. Encodes the same "actionable stage" logic as
-- src/lib/db/build.ts (stageOf / ACTIONABLE → comicvine | resolve | appearances)
-- but as one indexed query, so a build always fills a full batch. The old client
-- approach fetched only the top (limit*5) heroes by issue_count and filtered them
-- in JS — but the highest-published heroes are mostly already enriched, so it
-- returned far fewer than asked (e.g. 1 of 25).
create or replace function public.get_pending_build_ids(p_limit integer default 25)
returns setof text
language sql
stable
as $$
  select id
  from public.heroes
  where comicvine_status is distinct from 'failed'
    and (
      -- stage: comicvine (status null or anything that isn't done/failed)
      comicvine_status is distinct from 'done'
      -- stage: resolve identity
      or (comicvine_status = 'done' and wikidata_status = 'pending')
      -- stage: appearances & cast (resolved but not yet enriched)
      or (
        comicvine_status = 'done'
        and wikidata_status not in ('pending', 'ambiguous', 'unresolved')
        and wikidata_enriched_at is null
      )
    )
  order by issue_count desc nulls last
  limit greatest(p_limit, 0);
$$;

grant execute on function public.get_pending_build_ids(integer) to anon, authenticated;
