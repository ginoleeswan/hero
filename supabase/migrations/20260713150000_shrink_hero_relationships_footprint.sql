-- Shrink hero_relationships and stop it re-bloating — the table + its indexes
-- were the biggest chunk of the free-tier disk usage (227 MB; 156 MB of that
-- was indexes, ~35% of it bloat).
--
-- Three durable changes:
--
-- 1. fillfactor 100 on the indexes. hero_relationships is bulk-replaced by
--    rebuild_hero_relationships() (truncate + insert) and never updated in
--    place between rebuilds, so the default 90% leaf fill just wastes 10% —
--    100% packs the btrees as tight as possible.
--
-- 2. REINDEX at the end of every rebuild. The nightly truncate+insert rebuilds
--    the btrees incrementally (non-sequential inserts across three passes),
--    which accumulated ~35% bloat within a day — a one-off REINDEX would just
--    creep back. Reindexing as the last step of the rebuild keeps the indexes
--    tight in perpetuity. (Plain REINDEX, not CONCURRENTLY: the rebuild already
--    holds the table exclusively via TRUNCATE and runs in the 03:40 UTC
--    maintenance window, so the extra lock is free.)
--
-- 3. Cap teammates at 30/hero instead of 40. The app never requests more than
--    24 teammates (get_related_heroes callers: heroQueries 24, battle builder
--    20, curated rows 20) and the RPC orders by rank with a small limit, so
--    stored ranks 31-40 were dead rows — 68% of the table is teammate edges,
--    so trimming the tail is the highest-leverage row reduction. 30 keeps
--    headroom above the 24 request for the same-universe filter. Enemy/ally
--    stay at 60 (enemy is requested at 40 and needs the cross-universe margin).
--
-- Function body is otherwise identical to the previous definition.

alter index public.hero_relationships_pkey    set (fillfactor = 100);
alter index public.hero_relationships_lookup   set (fillfactor = 100);
alter index public.hero_relationships_reverse  set (fillfactor = 100);

create or replace function public.rebuild_hero_relationships()
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
begin
  truncate public.hero_relationships;

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

  insert into public.hero_relationships (hero_id, related_id, kind, source, rank, cross_universe)
  select hero_id, related_id, 'teammate', 'comicvine', rank, cross_universe
  from (
    select hero_id, related_id, cross_universe,
           row_number() over (partition by hero_id order by issue_count desc nulls last) as rank
    from (
      select distinct on (h.id, m.id)
        h.id as hero_id, m.id as related_id, m.issue_count,
        (m.publisher is distinct from h.publisher) as cross_universe
      from public.heroes h
      join public.heroes m on m.id <> h.id and m.teams && h.teams
      where h.teams is not null and array_length(h.teams, 1) > 0
    ) resolved
  ) ranked
  where rank <= 30;

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
  -- otherwise, which is what pushed the DB over the free-tier cap.
  reindex table public.hero_relationships;
end;
$function$;
