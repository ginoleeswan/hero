-- Team catalogue — a derived, rebuildable mirror of the hero layer.
-- heroes.teams[] is the source of truth; teams/team_members are projections of
-- it, rebuilt set-based by rebuild_teams(). Sibling of hero_relationships.
-- teams is UPSERT-stable (never truncated) because team_battle_votes/team_verdicts
-- reference team ids; only logo_url and is_featured are human-curated.

create table if not exists public.teams (
  id           text primary key,             -- stable slug e.g. 'avengers'
  name         text not null,
  publisher    text,
  logo_url     text,
  member_count integer not null default 0,
  popularity   bigint  not null default 0,   -- sum of members' issue_count
  is_featured  boolean not null default false,
  updated_at   timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id text not null references public.teams(id) on delete cascade,
  hero_id text not null references public.heroes(id) on delete cascade,
  rank    integer,
  primary key (team_id, hero_id)
);
create index if not exists team_members_team_idx on public.team_members (team_id, rank);
create index if not exists team_members_hero_idx on public.team_members (hero_id);

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

drop policy if exists teams_public_read on public.teams;
create policy teams_public_read on public.teams for select using (true);
drop policy if exists team_members_public_read on public.team_members;
create policy team_members_public_read on public.team_members for select using (true);

-- Slugify a team name → stable id. Lowercase, alnum→'-', collapse repeats, trim.
create or replace function public.slugify_team(p_name text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
$$;

-- Rebuild the whole team catalogue from heroes.teams[]. Idempotent.
-- Upserts teams (preserving curated logo_url + is_featured), regenerates members.
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

-- Read a team's roster joined to hero stats, ranked.
create or replace function public.get_team_roster(p_team_id text, p_limit integer default 5)
returns table (
  id text, name text, image_url text, portrait_url text, publisher text,
  intelligence int, strength int, speed int, durability int, power int, combat int,
  rank integer
)
language sql stable
set search_path = public
as $$
  select h.id, h.name, h.image_url, h.portrait_url, h.publisher,
         h.intelligence, h.strength, h.speed, h.durability, h.power, h.combat,
         m.rank
  from public.team_members m
  join public.heroes h on h.id = m.hero_id
  where m.team_id = p_team_id
  order by m.rank asc nulls last
  limit p_limit;
$$;

grant execute on function public.rebuild_teams()                     to service_role;
grant execute on function public.slugify_team(text)                  to anon, authenticated, service_role;
grant execute on function public.get_team_roster(text, integer)      to anon, authenticated, service_role;
