-- Ally must outrank teammate, or the ally faction is always empty.
--
-- Nodes are bucketed by the LOWEST kind ordinal among their ties, and teammate
-- previously sat above ally. Almost everyone a character is allied with also
-- shares a roster with them, so every ally collapsed into "teammate": Wonder
-- Woman's cast came out 15 teammates / 8 enemies / 1 family / 0 allies, which
-- is one shapeless blob rather than the balanced factions the graph draws.
--
-- Being named as someone's ally is a more specific claim than appearing on the
-- same roster -- rosters are broad and full of incidental membership (Alfred
-- Pennyworth and Renee Montoya arrive as Wonder Woman's "teammates" purely via
-- Justice League of America) -- so the ally tie wins the bucket AND the edge.
-- Both orderings have to agree, otherwise a node sits in the ally cluster while
-- its edge to the subject reports teammate.
--
-- After: 8 allies / 8 enemies / 7 teammates / 1 family.
CREATE OR REPLACE FUNCTION public.get_hero_neighborhood(p_hero_id text, p_limit integer DEFAULT 24)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  with subj as (
    select id, publisher from public.heroes where id = p_hero_id
  ),
  fam_all as (
    select r.hero_id as a, r.related_hero_id as b
    from public.hero_relatives r where r.related_hero_id is not null
    union
    select r.related_hero_id as a, r.hero_id as b
    from public.hero_relatives r where r.related_hero_id is not null
  ),
  cand as (
    select id, min(kind_ord) as kind_ord, min(best_rank) as best_rank
    from (
      select r.related_id as id,
             case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end as kind_ord,
             r.rank as best_rank
      from public.hero_relationships r
      where r.hero_id = p_hero_id
        and r.source is distinct from 'curated'
      union all
      select f.b as id, 0 as kind_ord, 0 as best_rank
      from fam_all f where f.a = p_hero_id
    ) u
    where id <> p_hero_id
    group by id
  ),
  scored as (
    select c.id, c.kind_ord, c.best_rank, h.fame_score,
           (h.publisher is not distinct from s.publisher) as same_universe
    from cand c
    join public.heroes h on h.id = c.id
    cross join subj s
  ),
  per_kind as (
    select *,
      row_number() over (
        partition by kind_ord
        order by same_universe desc, fame_score desc nulls last, best_rank asc nulls last
      ) as k_rn
    from scored
  ),
  neighbours as (
    select id
    from per_kind
    order by (k_rn > greatest(3, p_limit / 3)),
             same_universe desc,
             k_rn,
             fame_score desc nulls last
    limit p_limit
  ),
  node_ids as (
    select p_hero_id as id
    union
    select id from neighbours
  ),
  node_rows as (
    select h.id, h.name, h.avatar_url, h.portrait_url, h.image_md_url, h.image_url,
           h.portrait_blurhash,
           h.alignment, h.publisher, h.fame_score, h.teams,
           h.intelligence, h.strength, h.speed, h.durability, h.power, h.combat,
           h.powerstats_total,
           (h.id = p_hero_id) as is_subject
    from public.heroes h
    join node_ids n on n.id = h.id
  ),
  pair_edges as (
    select distinct
      least(r.hero_id, r.related_id) as a,
      greatest(r.hero_id, r.related_id) as b,
      r.kind
    from public.hero_relationships r
    where r.hero_id in (select id from node_ids)
      and r.related_id in (select id from node_ids)
      and r.hero_id <> r.related_id
      and r.source is distinct from 'curated'
    union
    select distinct least(f.a, f.b), greatest(f.a, f.b), 'family'
    from fam_all f
    where f.a in (select id from node_ids)
      and f.b in (select id from node_ids)
      and f.a <> f.b
  ),
  ranked as (
    select a, b, kind,
      row_number() over (
        partition by a, b
        order by case kind
                   when 'family' then 0 when 'enemy' then 1
                   when 'ally' then 2 when 'teammate' then 3 else 4 end
      ) as rn
    from pair_edges
  ),
  edge_rows as (
    select a as "from", b as "to", kind from ranked where rn = 1
  )
  select json_build_object(
    'nodes', coalesce((select json_agg(row_to_json(node_rows)) from node_rows), '[]'::json),
    'edges', coalesce((select json_agg(row_to_json(edge_rows)) from edge_rows), '[]'::json)
  );
$function$;
