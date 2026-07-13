-- Gate the derived relationship graph to edges that touch a recognizable character.
--
-- hero_relationships was 164MB (36% of the DB) with 636k rows, but 240,761 of them
-- (38%) are obscure<->obscure edges — "related heroes" for archive-tier characters
-- (fame < 5) linked only to other archive-tier characters. No feature surfaces
-- those: get_related_heroes is forward-only (needs the subject's rows), and the
-- reverse consumers (get_most_feared, get_relationship, get_hero_neighborhood, …)
-- only ever care about a famous character on at least one side.
--
-- So we keep an edge iff EITHER endpoint has fame_score >= 5 (Tiers A–C, the
-- "product"), dropping only obscure<->obscure edges. This is provably invisible to
-- famous characters: a famous character's forward rows all have itself (fame >= 5)
-- as the subject, and every reverse pointer lands on it (fame >= 5) as the object —
-- so its enemy/ally/teammate/feared_by counts are byte-identical. Only archive-tier
-- pages lose their (obscure-only) related lists, which is the intended tiering.
--
-- Reclaims ~62MB (636k -> ~396k rows) and makes the nightly rebuild cheaper still.
-- Reversible: lower the threshold (or drop the predicates) and re-run.
-- Everything else is unchanged from 20260713170000_bounded_teammate_rebuild.
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

  reindex table public.hero_relationships;
end;
$function$;
