-- Ego network for the character-page "social web": the subject + its top
-- neighbours by fame, plus EVERY hero_relationships edge among that node set
-- (the second-degree edges get_related_heroes does not expose). Undirected —
-- reciprocal/multi-kind pairs collapse to one edge, precedence enemy>teammate>ally.
create or replace function public.get_hero_neighborhood(
  p_hero_id text,
  p_limit integer default 24
)
returns json
language sql
stable
as $$
  with neighbours as (
    select r.related_id as id
    from public.hero_relationships r
    join public.heroes h on h.id = r.related_id
    where r.hero_id = p_hero_id
    group by r.related_id, h.fame_score
    order by h.fame_score desc nulls last, min(r.rank) asc nulls last
    limit p_limit
  ),
  node_ids as (
    select p_hero_id as id
    union
    select id from neighbours
  ),
  node_rows as (
    select h.id, h.name, h.portrait_url, h.image_md_url, h.image_url,
           h.alignment, h.publisher, h.fame_score,
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
  ),
  ranked as (
    select a, b, kind,
      row_number() over (
        partition by a, b
        order by case kind when 'enemy' then 0 when 'teammate' then 1 when 'ally' then 2 else 3 end
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
$$;

grant execute on function public.get_hero_neighborhood(text, integer) to anon, authenticated, service_role;
