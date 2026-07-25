-- Fix WHO appears in a character's universe, not how it's drawn.
--
-- Two defects, both from ranking a character's personal circle by GLOBAL fame:
--
--  1. Cross-universe crowding. Ordering the whole pool by fame_score meant the
--     most famous character who had ever touched the subject won a slot, so
--     Wonder Woman's universe led with Batman, Iron Man, Thanos, Doctor Doom
--     and Bugs Bunny (all real DC-vs-Marvel / Looney Tunes crossover rows) while
--     Ares, Circe, Giganta and Doctor Psycho fell below the cut. same_universe
--     is now the first sort key everywhere, as a PREFERENCE not a filter -- a
--     character whose only ties are cross-universe still gets a graph.
--
--  2. One kind ate the scene. Teammate edges come from shared team rosters and
--     are far more numerous than enemy edges, so a fame-ordered top 24 could
--     leave a character with one or two enemies on screen. Each kind now gets a
--     quota of roughly a third of p_limit, and only then do leftovers fill up.
--
-- Curated edges are excluded here: that list is Arena's dream-matchup table by
-- its own definition (Superman vs Magneto, Wonder Woman vs Batman). They are
-- statements about a hypothetical fight, not about a character's world, and they
-- were being pinned at rank 0. Arena still reads them; this screen no longer does.
CREATE OR REPLACE FUNCTION public.get_hero_neighborhood(p_hero_id text, p_limit integer DEFAULT 24)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  with subj as (
    select id, publisher from public.heroes where id = p_hero_id
  ),
  cand as (
    select r.related_id as id,
           -- Match the edge dedupe below, so a node's quota bucket agrees with
           -- the edge kind the client derives for it.
           min(case r.kind when 'enemy' then 0 when 'teammate' then 1 else 2 end) as kind_ord,
           min(r.rank) as best_rank
    from public.hero_relationships r
    where r.hero_id = p_hero_id
      and r.source is distinct from 'curated'
    group by r.related_id
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
    -- Quota rows first (false sorts before true), then the best of the rest.
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
$function$;
