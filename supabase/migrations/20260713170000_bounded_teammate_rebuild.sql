-- Fix nightly_maintenance() timing out every night inside rebuild_hero_relationships().
--
-- The teammate step self-joined heroes on `m.teams && h.teams` (array overlap),
-- which for a team of M members generates M² candidate pairs before the per-hero
-- top-30 cap. The catalogue grew to ~50k heroes; the biggest "team" now has 801
-- members (641k pairs from that one group), and the whole join materialises ~3.0M
-- pairs. Sorting/deduping 3M rows under the free-tier disk-IO ceiling blew the
-- 120s statement timeout — so the graph (enemy/ally/teammate, powering related-
-- hero lists) hasn't rebuilt in days.
--
-- Fix: cap the *candidate* (object) side to each team's top-30 most-notable
-- members. This is mathematically exact for a per-hero top-30 result — a subject's
-- 30 most-notable teammates are necessarily within their shared team's 30 most-
-- notable members — while collapsing the giant teams. Verified on current data:
-- bounded 394,981 vs unbounded 396,126 rows (0.29% diff, only at issue_count ties),
-- and runtime drops from >120s (timeout) to ~10.8s. The subject side still spans
-- every hero+team membership, so obscure heroes keep their teammate lists.
--
-- Everything else is unchanged from 20260713150000_shrink_hero_relationships_footprint.sql:
-- enemy/ally + curated inserts, the rank<=30 teammate cap, and the trailing
-- `reindex table` (the deliberate anti-bloat step that keeps the btrees tight and
-- the DB under the free-tier cap — retained on purpose).
create or replace function public.rebuild_hero_relationships()
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
begin
  truncate public.hero_relationships;

  -- Enemies / allies — resolved by name from heroes.enemies / heroes.friends.
  insert into public.hero_relationships (hero_id, related_id, kind, source, rank, cross_universe)
  select hero_id, related_id, kind, 'comicvine', rank, cross_universe
  from (
    select hero_id, related_id, kind, cross_universe,
           row_number() over (partition by hero_id, kind order by issue_count desc nulls last) as rank
    from (
      select distinct on (h.id, k.kind, nm.nm_name)
        h.id as hero_id, m.id as related_id, k.kind, m.issue_count,
        (m.publisher is distinct from h.publisher) as cross_universe
      from public.heroes h
      cross join (values ('enemy'), ('ally')) as k(kind)
      cross join lateral unnest(
        case when k.kind = 'ally' then h.friends else h.enemies end
      ) as nm(nm_name)
      join public.heroes m on m.name = nm.nm_name and m.id <> h.id
      order by h.id, k.kind, nm.nm_name, m.issue_count desc nulls last
    ) resolved
  ) ranked
  where rank <= 60;

  -- Teammates — shared-team pairs, with the candidate side bounded to each team's
  -- top-30 most-notable members (see header: exact for the per-hero top-30 cap).
  insert into public.hero_relationships (hero_id, related_id, kind, source, rank, cross_universe)
  with team_obj as (
    select team, hero_id, issue_count, publisher
    from (
      select t.team, h.id as hero_id, h.issue_count, h.publisher,
             row_number() over (partition by t.team
                                order by h.issue_count desc nulls last, h.id) as rn
      from public.heroes h
      cross join lateral unnest(h.teams) as t(team)
      where h.teams is not null and array_length(h.teams, 1) > 0
    ) r
    where rn <= 30
  ),
  subj as (
    select h.id as hero_id, h.publisher, t.team
    from public.heroes h
    cross join lateral unnest(h.teams) as t(team)
    where h.teams is not null and array_length(h.teams, 1) > 0
  ),
  ranked as (
    select hero_id, related_id, cross_universe,
           row_number() over (partition by hero_id order by issue_count desc nulls last) as rank
    from (
      select distinct on (s.hero_id, o.hero_id)
        s.hero_id, o.hero_id as related_id, o.issue_count,
        (o.publisher is distinct from s.publisher) as cross_universe
      from subj s
      join team_obj o on o.team = s.team and o.hero_id <> s.hero_id
      order by s.hero_id, o.hero_id, o.issue_count desc nulls last
    ) resolved
  )
  select hero_id, related_id, 'teammate', 'comicvine', rank, cross_universe
  from ranked
  where rank <= 30;

  -- Curated marquee rivalries — override source/rank on the resolved pairs.
  insert into public.hero_relationships (hero_id, related_id, kind, source, rank, cross_universe)
  with curated(a, b) as (
    values
      ('Batman','Superman'),('Batman','Joker'),('Batman','Bane'),
      ('Superman','Magneto'),('Superman','Captain America'),
      ('Joker','Captain America'),
      ('Spider-Man','Green Goblin'),('Spider-Man','Venom'),('Spider-Man','Wolverine'),
      ('Iron Man','Doctor Doom'),('Iron Man','Wolverine'),('Iron Man','Hulk'),
      ('Captain America','Magneto'),('Captain America','Doctor Doom'),
      ('Wolverine','Hulk'),('Wolverine','Sabretooth'),
      ('Hulk','Thor'),('Thor','Magneto'),('Thor','Loki'),
      ('Loki','Iron Man'),('Magneto','Cyclops'),
      ('Wonder Woman','Batman'),('Wonder Woman','Superman'),
      ('Doctor Strange','Doctor Doom'),('Doctor Strange','Loki'),
      ('Darth Vader','Superman'),('Darth Vader','Captain America'),
      ('Cyclops','Mystique'),('Mystique','Wolverine'),('Storm','Magneto')
  ),
  pairs(src, dst) as (
    select a, b from curated
    union
    select b, a from curated
  ),
  resolved as (
    select distinct on (p.src, p.dst)
      ha.id as hero_id, hb.id as related_id,
      (hb.publisher is distinct from ha.publisher) as cross_universe
    from pairs p
    join lateral (
      select id, publisher from public.heroes where name = p.src
      order by issue_count desc nulls last limit 1
    ) ha on true
    join lateral (
      select id, publisher from public.heroes where name = p.dst
      order by issue_count desc nulls last limit 1
    ) hb on true
  )
  select hero_id, related_id, 'enemy', 'curated', 0, cross_universe
  from resolved
  where hero_id <> related_id
  on conflict (hero_id, kind, related_id)
    do update set source = 'curated', rank = 0;

  -- Keep the btrees tight — the incremental rebuild above bloats them ~35%/day
  -- otherwise, which is what pushed the DB over the free-tier cap. Deliberately
  -- retained from 20260713150000_shrink_hero_relationships_footprint.sql.
  reindex table public.hero_relationships;
end;
$function$;
