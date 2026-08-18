-- Attach the curated relationship note to subject-incident edges.
--
-- Only where one end IS the subject: that's the only pair the focus card can
-- describe, and hanging a paragraph off all ~250 edges would multiply the
-- payload for text nothing reads.
CREATE OR REPLACE FUNCTION public.get_hero_neighborhood(p_hero_id text, p_limit integer DEFAULT 24)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  with subj as (
    select id, publisher from public.heroes where id = p_hero_id
  ),
  fam_all as (
    select r.hero_id as a, r.related_hero_id as b, r.relation::text as relation
    from public.hero_relatives r where r.related_hero_id is not null
    union
    select r.related_hero_id as a, r.hero_id as b,
           case r.relation::text
             when 'parent' then 'child'
             when 'child' then 'parent'
             when 'grandparent' then 'grandchild'
             when 'grandchild' then 'grandparent'
             when 'aunt_uncle' then 'niece_nephew'
             when 'niece_nephew' then 'aunt_uncle'
             when 'ancestor' then 'descendant'
             else r.relation::text
           end
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
      r.kind,
      null::text as relation
    from public.hero_relationships r
    where r.hero_id in (select id from node_ids)
      and r.related_id in (select id from node_ids)
      and r.hero_id <> r.related_id
      and r.source is distinct from 'curated'
    union
    select distinct f.a, f.b, 'family', f.relation
    from fam_all f
    where f.a in (select id from node_ids)
      and f.b in (select id from node_ids)
      and f.a <> f.b
  ),
  ranked as (
    select
      case when kind = 'family' then a else least(a, b) end as a,
      case when kind = 'family' then b else greatest(a, b) end as b,
      kind, relation,
      row_number() over (
        partition by least(a, b), greatest(a, b)
        order by case kind
                   when 'family' then 0 when 'enemy' then 1
                   when 'ally' then 2 when 'teammate' then 3 else 4 end,
                 (a is distinct from p_hero_id)
      ) as rn
    from pair_edges
  ),
  edge_rows as (
    select r.a as "from", r.b as "to", r.kind, r.relation,
           case when p_hero_id in (r.a, r.b) then bl.blurb end as blurb
    from ranked r
    left join public.hero_relationship_blurbs bl
      on bl.hero_a = least(r.a, r.b) and bl.hero_b = greatest(r.a, r.b)
    where r.rn = 1
  )
  select json_build_object(
    'nodes', coalesce((select json_agg(row_to_json(node_rows)) from node_rows), '[]'::json),
    'edges', coalesce((select json_agg(row_to_json(edge_rows)) from edge_rows), '[]'::json)
  );
$function$;;
