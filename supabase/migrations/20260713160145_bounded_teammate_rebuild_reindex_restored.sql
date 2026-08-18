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
$function$;;
