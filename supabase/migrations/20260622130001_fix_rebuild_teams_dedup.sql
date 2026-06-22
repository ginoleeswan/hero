-- Fix rebuild_teams: deduplicate (team_id, hero_id) pairs before ranking
-- to handle heroes whose teams[] array contains the same team name with
-- different casing/spacing that both slugify to the same slug.
create or replace function public.rebuild_teams()
returns void language plpgsql
set search_path = public
as $$
begin
  -- 1. Upsert team rows from distinct, non-empty team names.
  with exploded as (
    select trim(t) as name, h.publisher, h.issue_count
    from public.heroes h
    cross join lateral unnest(h.teams) as t
    where h.teams is not null and length(trim(t)) > 1
  ),
  agg as (
    select slugify_team(name) as id,
           min(name) as name,
           mode() within group (order by publisher) as publisher,
           count(*) as member_count,
           coalesce(sum(issue_count), 0)::bigint as popularity
    from exploded
    where slugify_team(name) <> ''
    group by slugify_team(name)
  )
  insert into public.teams (id, name, publisher, member_count, popularity, updated_at)
  select id, name, publisher, member_count, popularity, now() from agg
  on conflict (id) do update set
    name = excluded.name,
    publisher = excluded.publisher,
    member_count = excluded.member_count,
    popularity = excluded.popularity,
    updated_at = now();
  -- (logo_url and is_featured are intentionally NOT overwritten.)

  -- 2. Regenerate member edges, ranked by hero popularity, bounded to 40.
  --    Dedup (team_id, hero_id) pairs first so duplicate team-name spellings
  --    that collapse to the same slug don't violate the PK.
  truncate public.team_members;
  insert into public.team_members (team_id, hero_id, rank)
  select team_id, hero_id, rank from (
    select distinct on (team_id, hero_id)
           slugify_team(trim(t)) as team_id, h.id as hero_id,
           row_number() over (partition by slugify_team(trim(t))
                              order by h.issue_count desc nulls last) as rank
    from public.heroes h
    cross join lateral unnest(h.teams) as t
    where h.teams is not null and length(trim(t)) > 1 and slugify_team(trim(t)) <> ''
    order by team_id, hero_id
  ) ranked
  where rank <= 40;
end;
$$;
