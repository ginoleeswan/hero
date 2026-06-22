-- Fix: deduplicate (team-slug, hero) pairs BEFORE counting members and ranking,
-- so a hero listing two spellings of the same team ("Avengers" + "avengers")
-- counts once and ranks stay contiguous. member_count = distinct heroes.
create or replace function public.rebuild_teams()
returns void language plpgsql
set search_path = public
as $$
begin
  with member_pairs as (  -- exactly one row per (team-slug, hero)
    select distinct slugify_team(trim(t)) as id, h.id as hero_id, h.publisher, h.issue_count
    from public.heroes h
    cross join lateral unnest(h.teams) as t
    where h.teams is not null and length(trim(t)) > 1 and slugify_team(trim(t)) <> ''
  ),
  team_names as (         -- one display name per slug (first alphabetically)
    select id, name from (
      select slugify_team(trim(t)) as id, trim(t) as name,
             row_number() over (partition by slugify_team(trim(t)) order by trim(t)) as rn
      from public.heroes h
      cross join lateral unnest(h.teams) as t
      where h.teams is not null and length(trim(t)) > 1 and slugify_team(trim(t)) <> ''
    ) z where rn = 1
  )
  insert into public.teams (id, name, publisher, member_count, popularity, updated_at)
  select mp.id, tn.name,
         mode() within group (order by mp.publisher) as publisher,
         count(*) as member_count,
         coalesce(sum(mp.issue_count), 0)::bigint as popularity,
         now()
  from member_pairs mp
  join team_names tn on tn.id = mp.id
  group by mp.id, tn.name
  on conflict (id) do update set
    name = excluded.name, publisher = excluded.publisher,
    member_count = excluded.member_count, popularity = excluded.popularity, updated_at = now();
  -- (logo_url and is_featured intentionally preserved.)

  truncate public.team_members;
  insert into public.team_members (team_id, hero_id, rank)
  select id, hero_id, rank from (
    select id, hero_id,
           row_number() over (partition by id order by issue_count desc nulls last) as rank
    from (
      select distinct slugify_team(trim(t)) as id, h.id as hero_id, h.issue_count
      from public.heroes h
      cross join lateral unnest(h.teams) as t
      where h.teams is not null and length(trim(t)) > 1 and slugify_team(trim(t)) <> ''
    ) deduped
  ) ranked
  where rank <= 40;
end;
$$;
