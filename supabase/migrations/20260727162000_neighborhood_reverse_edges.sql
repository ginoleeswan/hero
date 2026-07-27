-- Universe pages were blank for anyone whose own arrays were empty.
--
-- get_hero_neighborhood built candidates from OUTGOING edges only, so a
-- character nobody points out from got an empty page even when many characters
-- pointed AT them. Measured 2026-07-27: 1,468 heroes have zero outgoing edges
-- but at least one incoming edge or kin link. Dracula had 70 characters naming
-- him an enemy and rendered nothing. Harry Potter 10. Sherlock Holmes 5.
--
-- Why the reverse pull is BOUNDED. The naive union is a page-killer:
--
--   Batman, outgoing only          135 candidates      (today)
--   Batman, naive union          2,792 candidates      2,928 ms
--   Batman, + top-150 reverse      241 candidates         10 ms
--
-- Anon statement_timeout is 3s, so the naive version times out the highest
-- traffic universe page in the app. The cost is one heroes_pkey lookup per
-- candidate at ~1ms under the free-tier IO ceiling, so the fix is to score
-- fewer candidates, not to index harder.
--
-- `rank` is the subject's position in the OTHER character's list. It was chosen
-- as the reverse pull's sort on the theory that rank 1 means "the subject is
-- that character's top enemy" -- a relevance signal. MEASURED 2026-07-27, that
-- theory is WRONG for exactly the subjects where the bound bites: 3,217 of
-- Batman's 3,221 reverse edges are rank 1, because rank is assigned by
-- issue_count within the other character's list and Batman outranks nearly
-- everyone. So on a famous subject the cut is an arbitrary slice of one huge
-- tie block, and `hero_id` below is what makes that slice at least repeatable.
--
-- This is tolerable rather than good, on two grounds. The bound only truncates
-- when a subject has >150 incoming edges, and only MATTERS for slot-filling
-- when that subject also has <24 outgoing -- measured: 1 hero in the catalogue.
-- And for bucketing (see min(kind_ord) below) the cut can only ever move a
-- candidate to a MORE specific kind, never a worse one, so an arbitrary slice
-- means some mutual pairs miss the improvement, not that any pair regresses.
--
-- The principled fix, if this ever matters: order the reverse pull by the
-- CANDIDATE's fame_score rather than by rank, or decouple bucketing from the
-- bound by computing min(kind_ord) over the unbounded reverse set. Deferred.
--
-- Why outgoing WINS a SLOT. A character's own stated cast outranks people who
-- merely name them, so is_out sorts first in both the per-kind window and the
-- final order. No reverse candidate can take a slot an outgoing one wanted:
-- Batman's 135 outgoing candidates fill all 24. Dracula has none, so his page
-- fills entirely from reverse edges -- that is the blank-page fix.
--
-- But the reverse source DOES change which BUCKET a mutual pair lands in, and
-- that is deliberate. min(kind_ord) below is computed over both directions, so
-- a pair the subject calls "teammate" while the counterpart calls it "ally"
-- now buckets as ally. Measured: 9 of Batman's 135 candidates re-bucket 3->2
-- (Batgirl, Green Arrow, Hal Jordan, Lex Luthor, Martian Manhunter, Poison Ivy,
-- Starfire, Supergirl, Superman). WHICH 9 is a function of the 150-row reverse
-- cut, which slices an arbitrary-but-repeatable point in a 3,217-row rank tie --
-- see the header. Only ever a move to a MORE specific kind, so pairs outside the
-- cut keep the bucket they always had; none regresses.
--
-- This FIXES a pre-existing disagreement rather than causing one. pair_edges
-- below is direction-agnostic, so those edges already rendered as 'ally' while
-- the node sat in the teammate cluster -- exactly the split 20260725204300 was
-- written to forbid: "Both orderings have to agree, otherwise a node sits in
-- the ally cluster while its edge to the subject reports teammate." Bucket and
-- edge now agree. Do NOT "fix" this by adding filter (where is_out = 1) to
-- min(kind_ord); that would restore the disagreement.
create or replace function public.get_hero_neighborhood(p_hero_id text, p_limit integer default 24)
 returns json
 language sql
 stable
as $function$
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
    select id,
           min(kind_ord) as kind_ord,
           -- Prefer the outgoing rank when the pair is mutual, so a candidate's
           -- position WITHIN its bucket is not perturbed by the reverse source.
           -- (Its bucket may still change -- see the header on min(kind_ord).)
           -- Presence-based, not value-based: `min() filter` returns null both
           -- when there are no outgoing rows AND when every outgoing rank is
           -- null, and the latter would silently fall through to a reverse rank,
           -- promoting a nulls-last candidate. No null ranks exist today; this
           -- keeps it correct if any appear.
           case when max(is_out) = 1
                then min(best_rank) filter (where is_out = 1)
                else min(best_rank) end as best_rank,
           max(is_out) as is_out
    from (
      select r.related_id as id,
             case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end as kind_ord,
             r.rank as best_rank,
             1 as is_out
      from public.hero_relationships r
      where r.hero_id = p_hero_id
        and r.source is distinct from 'curated'
      union all
      -- Bounded. See the header: unbounded this is 2,928ms on Batman.
      select * from (
        select r.hero_id as id,
               case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end as kind_ord,
               r.rank as best_rank,
               0 as is_out
        from public.hero_relationships r
        where r.related_id = p_hero_id
          and r.source is distinct from 'curated'
        -- hero_id breaks rank ties so the 150-row cut is itself deterministic;
        -- ranks are small dense integers, so the tier straddling row 150 would
        -- otherwise be sliced by whatever the plan produced.
        order by r.rank asc, r.hero_id
        limit 150
      ) rev
      union all
      select f.b as id, 0 as kind_ord, 0 as best_rank, 1 as is_out
      from fam_all f where f.a = p_hero_id
    ) u
    where id <> p_hero_id
    group by id
  ),
  scored as (
    select c.id, c.kind_ord, c.best_rank, c.is_out, h.fame_score,
           (h.publisher is not distinct from s.publisher) as same_universe
    from cand c
    join public.heroes h on h.id = c.id
    cross join subj s
  ),
  per_kind as (
    select *,
      row_number() over (
        partition by kind_ord
        -- `id` last is a DETERMINISM fix, not a ranking preference. Without it
        -- the sort keys tie outright for some pairs — Thomas Wayne and Tim Drake
        -- are both family, same-universe, fame 50, best_rank 0 — and Postgres
        -- breaks the tie by whatever the plan happens to produce. That made the
        -- 24-slot cutoff non-deterministic: the same character's page could
        -- return a different neighbour set after an unrelated replan. Measured
        -- 2026-07-27: adding the bounded reverse source changed the plan and
        -- swapped 5 of Batman's 24 nodes, all of them ties, none reverse-sourced.
        order by is_out desc, same_universe desc, fame_score desc nulls last,
                 best_rank asc nulls last, id
      ) as k_rn
    from scored
  ),
  neighbours as (
    select id
    from per_kind
    order by is_out desc,
             (k_rn > greatest(3, p_limit / 3)),
             same_universe desc,
             k_rn,
             fame_score desc nulls last,
             id
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
    -- status filter: a decline row carries a null blurb, and must yield null so
    -- the card falls back to describeRelationship() rather than showing nothing.
    left join public.hero_relationship_blurbs bl
      on bl.hero_a = least(r.a, r.b) and bl.hero_b = greatest(r.a, r.b)
     and bl.status = 'written'
    where r.rn = 1
  )
  select json_build_object(
    'nodes', coalesce((select json_agg(row_to_json(node_rows)) from node_rows), '[]'::json),
    'edges', coalesce((select json_agg(row_to_json(edge_rows)) from edge_rows), '[]'::json)
  );
$function$;
