-- Rank the authoring queue by cast, rather than filtering on it.
--
-- Measured against 200 hand-authored decisions (base rate 46% written):
--
--   same cast                    77% precision, 66% recall    79 pairs
--   same cast + gotham umbrella  71% precision, 73% recall    94 pairs
--   + "both are A-list"          54% precision, 99% recall   169 pairs
--
-- The third rule is worthless — 54% IS the base rate, so "both famous" readmits
-- everything. A-listers do cross casts, but most A-list pairs are still not
-- worth writing about.
--
-- Filtering on same_cast was the obvious move and is the wrong one: at 66-73%
-- recall it would permanently discard a quarter to a third of the pairs that DO
-- deserve a blurb — Captain America/Spider-Man, Iron Man/Wolverine, Lex Luthor/
-- Batman and Batman/Lois Lane all cross cast lines and were all written.
--
-- So same_cast becomes a ranking column, not a predicate. Working the queue in
-- same_cast-first order front-loads a 77%-hit-rate band and pushes the thin
-- crossover tail to the end, where stopping is a decision rather than an
-- accident. Nothing is discarded; the ordering just stops wasting judgment
-- early. Read it as:
--   select * from hero_relationship_blurb_queue
--   order by same_cast desc, fame_total desc, name_a, name_b, hero_a, hero_b;
--
-- The fame CTE is carried over unchanged from 20260727210000 — it is what keeps
-- this view at ~90ms/5.5k buffers instead of 17s/870k with disk spill, which
-- matters because evaluating it evicts the neighbourhood RPC's cache.
create or replace view public.hero_relationship_blurb_queue as
with fame as (
  select id, name, fame_score, publisher from public.heroes where fame_score >= 60
),
e as (
  select least(r.hero_id, r.related_id) as a,
         greatest(r.hero_id, r.related_id) as b,
         min(case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end) as kind_ord
  from public.hero_relationships r
  where r.source is distinct from 'curated'
    and r.hero_id in (select id from fame)
    and r.related_id in (select id from fame)
  group by 1, 2
),
f as (
  select least(hero_id, related_hero_id) as a,
         greatest(hero_id, related_hero_id) as b,
         0 as kind_ord
  from public.hero_relatives
  where related_hero_id is not null
    and hero_id in (select id from fame)
    and related_hero_id in (select id from fame)
  group by 1, 2
),
u as (
  select a, b, min(kind_ord) as kind_ord
  from (select * from e union all select * from f) z
  group by 1, 2
)
select
  u.a as hero_a,
  u.b as hero_b,
  ha.name as name_a,
  hb.name as name_b,
  ha.fame_score as fame_a,
  hb.fame_score as fame_b,
  ha.publisher,
  case u.kind_ord when 0 then 'family' when 1 then 'enemy' else 'ally' end as kind,
  ha.fame_score + hb.fame_score as fame_total,
  exists (
    select 1 from public.hero_cast_tags ta
    join public.hero_cast_tags tb on tb.cast_tag = ta.cast_tag
    where ta.hero_id = u.a and tb.hero_id = u.b
  ) as same_cast,
  (select string_agg(ta.cast_tag, ', ' order by ta.cast_tag)
     from public.hero_cast_tags ta
     join public.hero_cast_tags tb on tb.cast_tag = ta.cast_tag
    where ta.hero_id = u.a and tb.hero_id = u.b) as shared_casts
from u
join fame ha on ha.id = u.a
join fame hb on hb.id = u.b
where u.a <> u.b
  and u.kind_ord < 3
  and ha.publisher is not distinct from hb.publisher
  and not exists (
    select 1 from public.hero_relationship_blurbs bl
    where bl.hero_a = u.a and bl.hero_b = u.b
  );

revoke all on public.hero_relationship_blurb_queue from anon, authenticated;
