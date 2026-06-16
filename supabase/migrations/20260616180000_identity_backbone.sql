-- Identity backbone: make the hero's primary key a source-neutral internal id,
-- and treat every external system's id as a unique *attribute* (comicvine_id,
-- wikidata_qid, and now superhero_api_id). This decouples our catalogue identity
-- from any single upstream API (SuperheroAPI → ComicVine → Wikidata → TMDB).

-- 1. SuperheroAPI id as an explicit attribute, backfilled from the legacy numeric
--    primary keys (which were minted from SuperheroAPI). The source is now
--    recorded in a column instead of smuggled into the id.
alter table public.heroes add column if not exists superhero_api_id text;
update public.heroes set superhero_api_id = id
where superhero_api_id is null and id ~ '^[0-9]+$';
create unique index if not exists heroes_superhero_api_id_key
  on public.heroes (superhero_api_id) where superhero_api_id is not null;

-- 2. Add ComicVine characters with a source-neutral internal id (h_<uuid>) and
--    keep comicvine_id purely as the unique attribute. Dedup on comicvine_id (the
--    real key) rather than the id. Returns the minted rows so the client can track
--    the actual hero id instead of assuming a 'cv-<id>' shape.
drop function if exists public.admin_add_comicvine_heroes(jsonb);
create or replace function public.admin_add_comicvine_heroes(p_heroes jsonb)
returns table (id text, comicvine_id text)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  return query
    insert into public.heroes (id, name, comicvine_id, image_url, comicvine_status)
    select 'h_' || gen_random_uuid(), e->>'name', e->>'id', nullif(e->>'image', ''), 'pending'
    from jsonb_array_elements(p_heroes) e
    where coalesce(e->>'id', '') <> '' and coalesce(e->>'name', '') <> ''
    on conflict (comicvine_id) do nothing
    returning heroes.id, heroes.comicvine_id;
end $function$;

-- 3. Merge two heroes that are the same real-world character. Repoints the
--    curated / AI-generated child data (which won't cheaply regenerate) and the
--    user data from loser → winner, carries any external ids / Wikidata identity
--    the winner is missing, then deletes the loser (CASCADE clears the rest) and
--    rebuilds the relationship graph. This is the generalised, one-click version
--    of the manual dedup pass.
create or replace function public.admin_merge_heroes(p_loser text, p_winner text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  l_cv text; l_sa text; l_qid text;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_loser = p_winner then raise exception 'loser and winner must differ'; end if;
  if not exists (select 1 from public.heroes where id = p_winner) then
    raise exception 'winner % not found', p_winner;
  end if;
  if not exists (select 1 from public.heroes where id = p_loser) then
    raise exception 'loser % not found', p_loser;
  end if;

  select comicvine_id, superhero_api_id, wikidata_qid into l_cv, l_sa, l_qid
  from public.heroes where id = p_loser;

  -- curated / AI-generated data
  update hero_narrative_facts set hero_id = p_winner where hero_id = p_loser;
  update hero_relatives set hero_id = p_winner where hero_id = p_loser;
  update hero_relatives set related_hero_id = p_winner where related_hero_id = p_loser;
  insert into hero_tags (hero_id, tag)
    select p_winner, tag from hero_tags t where t.hero_id = p_loser
    and not exists (select 1 from hero_tags t2 where t2.hero_id = p_winner and t2.tag = t.tag);
  insert into hero_facts (hero_id, key, value, source)
    select p_winner, key, value, source from hero_facts f where f.hero_id = p_loser
    and not exists (select 1 from hero_facts f2 where f2.hero_id = p_winner and f2.key = f.key);

  -- user data (favourites + view history): repoint where the user has no winner
  -- row yet, otherwise drop the duplicate
  update user_favourites uf set hero_id = p_winner where uf.hero_id = p_loser
    and not exists (select 1 from user_favourites u2 where u2.user_id = uf.user_id and u2.hero_id = p_winner);
  delete from user_favourites where hero_id = p_loser;
  update user_view_history v set hero_id = p_winner where v.hero_id = p_loser
    and not exists (select 1 from user_view_history v2 where v2.user_id = v.user_id and v2.hero_id = p_winner);
  delete from user_view_history where hero_id = p_loser;
  delete from verdicts where hero_a_id = p_loser or hero_b_id = p_loser;

  -- delete the loser FIRST so its unique external ids are free to adopt
  delete from public.heroes where id = p_loser;

  update public.heroes w set
    comicvine_id     = coalesce(w.comicvine_id, l_cv),
    superhero_api_id = coalesce(w.superhero_api_id, l_sa),
    wikidata_qid     = coalesce(w.wikidata_qid, l_qid),
    wikidata_status  = case when w.wikidata_qid is null and l_qid is not null
                            then 'resolved' else w.wikidata_status end
  where w.id = p_winner;

  perform public.rebuild_hero_relationships();
end $function$;

-- 4. Candidate duplicates for the admin dedup panel. A name-group is a likely
--    duplicate only when it contains an UNLINKED row (no comicvine_id) — that's
--    the realistic case (a legacy/manual row next to its linked twin). Same-name
--    rows that all have distinct comicvine_ids are distinct characters ComicVine
--    has disambiguated, so they're excluded as noise. The human confirms each.
create or replace function public.find_duplicate_heroes(p_limit integer default 60)
returns table (
  name text, hero_id text, publisher text, comicvine_id text, superhero_api_id text,
  issue_count integer, image_url text, comicvine_status text, wikidata_qid text
)
language sql
stable
as $function$
  with dup_names as (
    select lower(trim(name)) as nm
    from public.heroes
    group by lower(trim(name))
    having count(*) > 1 and bool_or(comicvine_id is null)
  )
  select h.name, h.id, h.publisher, h.comicvine_id, h.superhero_api_id, h.issue_count,
         coalesce(h.portrait_url, h.image_md_url, h.image_url), h.comicvine_status, h.wikidata_qid
  from public.heroes h
  join dup_names d on lower(trim(h.name)) = d.nm
  order by lower(trim(h.name)), h.issue_count desc nulls last
  limit greatest(p_limit, 0) * 6;
$function$;

-- Pin search_path and lock the admin/dedup functions to signed-in users (anon
-- revoked); the internal is_admin gate still restricts them to admins.
alter function public.get_pending_build_ids(integer) set search_path = public;
alter function public.find_duplicate_heroes(integer) set search_path = public;
revoke execute on function public.admin_add_comicvine_heroes(jsonb) from public;
grant execute on function public.admin_add_comicvine_heroes(jsonb) to authenticated;
revoke execute on function public.admin_merge_heroes(text, text) from public;
grant execute on function public.admin_merge_heroes(text, text) to authenticated;
revoke execute on function public.find_duplicate_heroes(integer) from public;
grant execute on function public.find_duplicate_heroes(integer) to authenticated;
