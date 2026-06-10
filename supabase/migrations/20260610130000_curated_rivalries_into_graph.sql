-- Fold the curated marquee rivalries into the relationship graph as
-- source='curated', resolved by NAME (so they track the live hero ids instead of
-- the stale hardcoded ids in src/constants/rivals.ts, e.g. Batman was pointing at
-- Batman Beyond). Curated edges rank 0 (lead) and survive the same-universe
-- filter, so cross-publisher dream matchups (Superman vs Magneto) stay.

create or replace function public.rebuild_hero_relationships()
returns void
language plpgsql
as $$
begin
  truncate public.hero_relationships;

  -- enemies + allies — resolve each name to the most-popular matching hero,
  -- dedupe, then rank by that hero's popularity within (subject, kind).
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

  -- teammates — heroes that share a team. Bounded to the top 40 by popularity.
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
  where rank <= 40;

  -- curated marquee rivalries — canonical/dream matchups the dataset misses or
  -- buries. Defined by name, symmetric, resolved to the most-popular live id.
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
$$;
