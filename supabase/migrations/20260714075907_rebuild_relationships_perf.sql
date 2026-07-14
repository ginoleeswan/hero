-- Make the nightly relationship rebuild fast and reliable.
--
-- rebuild_hero_relationships() had been failing most nights at the 120s
-- statement_timeout (2026-07-11, -12, -13) and only squeaking through at 109s on
-- warm cache. Root causes, in order of impact:
--
--   1. hero_relationships carried two ON DELETE CASCADE FKs to heroes. Rebuilding
--      ~400k rows fired ~800k `SELECT 1 FROM heroes ... FOR KEY SHARE` checks —
--      both a large time cost and the source of lock contention with concurrent
--      heroes UPDATEs (the enrichment drains), which is where the nightly actually
--      stalled. The table is a *fully derived cache*: TRUNCATE'd and rebuilt every
--      night purely from joins against heroes, so every inserted id provably
--      exists. Referential integrity is guaranteed structurally; orphans from a
--      mid-day hard delete self-heal on the next rebuild and are invisible to the
--      read RPCs (they all inner-join back to heroes). Drop the FKs.
--
--   2. A trailing `reindex table` (added in 20260713190000) rebuilt every index a
--      second time — redundant after TRUNCATE+INSERT, which already builds them.
--
--   3. The teammate step did two full sequential scans of the 197MB heroes heap.
--      Cold at 03:40 those cost ~7s each and caused the flap. A covering partial
--      index (teams arrays max 20 items / 536B, safely btree-includable) makes them
--      index-only over just the ~19.5k team-bearing rows. The enemy/ally step's own
--      scan is only ~2s (its cost is the name-join, not the scan) and it warms the
--      heap cache for the teammate step, so it needs no index — and its enemies/
--      friends arrays (up to 120 items) exceed the btree tuple limit anyway.
--
--   4. Timeout headroom: a function-level SET statement_timeout does not affect the
--      already-running outer statement, so lift it in the cron command instead.
--
-- Reversible: re-add the FKs, drop the two indexes, restore the reindex, and reset
-- the cron command to `select public.nightly_maintenance();`.

-- 1. Drop the FK overhead + contention.
alter table public.hero_relationships drop constraint hero_relationships_hero_id_fkey;
alter table public.hero_relationships drop constraint hero_relationships_related_id_fkey;

-- 2. Covering partial index so the teammate step reads only team-bearing heroes
--    (index-only), not the full 197MB heap. Columns match exactly what the scan
--    needs; enrichment writes touch none of them, so heroes UPDATEs stay
--    HOT-eligible and don't pay index maintenance.
create index if not exists heroes_team_rebuild
  on public.heroes (id) include (teams, issue_count, publisher, fame_score)
  where teams is not null and array_length(teams, 1) > 0;

-- 3. Rebuild fn: drop the redundant trailing REINDEX. The teammate CTEs already
--    carry the matching `teams is not null ...` predicate, so they pick up
--    heroes_team_rebuild as-is. Enemy/ally logic is unchanged.
create or replace function public.rebuild_hero_relationships()
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
begin
  truncate public.hero_relationships;

  -- Enemies / allies — resolved by name; keep the edge if either side is fame >= 5.
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
      where h.fame_score >= 5 or m.fame_score >= 5
      order by h.id, k.kind, nm.nm_name, m.issue_count desc nulls last
    ) resolved
  ) ranked
  where rank <= 60;

  -- Teammates — bounded top-30-per-team candidate side; keep the edge if either
  -- side is fame >= 5 (applied at the pair join, so the top-30 cap stays by fame/issue_count).
  insert into public.hero_relationships (hero_id, related_id, kind, source, rank, cross_universe)
  with team_obj as (
    select team, hero_id, issue_count, publisher, fame
    from (
      select t.team, h.id as hero_id, h.issue_count, h.publisher, h.fame_score as fame,
             row_number() over (partition by t.team
                                order by h.issue_count desc nulls last, h.id) as rn
      from public.heroes h
      cross join lateral unnest(h.teams) as t(team)
      where h.teams is not null and array_length(h.teams, 1) > 0
    ) r
    where rn <= 30
  ),
  subj as (
    select h.id as hero_id, h.publisher, h.fame_score as fame, t.team
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
                     and (s.fame >= 5 or o.fame >= 5)
      order by s.hero_id, o.hero_id, o.issue_count desc nulls last
    ) resolved
  )
  select hero_id, related_id, 'teammate', 'comicvine', rank, cross_universe
  from ranked
  where rank <= 30;

  -- Curated marquee rivalries — always kept (all famous pairs), override source/rank.
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
end;
$function$;

-- 4. Give the nightly job real headroom. Session-level SET in the command is the
--    only reliable way — a function-local SET can't disarm the running statement's
--    timer. work_mem keeps the rebuild's ~26MB sorts in memory (it runs alone at
--    03:40). Measured end-to-end: ~110s (flapping/failing) -> ~56s with headroom.
select cron.schedule(
  'nightly-maintenance',
  '40 3 * * *',
  $cmd$set statement_timeout to '10min'; set work_mem to '128MB'; select public.nightly_maintenance();$cmd$
);
