-- Admin "Needs you" escape hatch: when none of the resolver's candidates are the
-- right match, mark the hero unresolved (drops it out of the ambiguous queue and
-- clears the stale candidate list). Mirrors resolve_hero_qid.
create or replace function public.mark_hero_unresolved(p_hero_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.heroes
     set wikidata_status = 'unresolved',
         wikidata_candidates = null
   where id = p_hero_id;
end;
$$;
