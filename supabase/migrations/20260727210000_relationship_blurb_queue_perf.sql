-- Rewrite hero_relationship_blurb_queue: push the fame >= 60 gate before the
-- aggregate instead of filtering after both heroes_pkey joins.
--
-- 20260727161000 built pair candidates from the FULL edge graph (~400k rows
-- across hero_relationships + hero_relatives), grouped them into ~108k
-- distinct pairs, joined heroes twice (216,084 pkey probes), and only THEN
-- applied `least(ha.fame_score, hb.fame_score) >= 60` -- discarding 105,016
-- of the 108,042 pairs it had just paid to build and join. Measured
-- 2026-07-27 on live: 12,981 ms wall, 869,728 buffers, the pre-join sort
-- spilling ~5.9MB to disk (Sort Method: external merge) and the
-- HashAggregate spilling 23MB across 21 batches. That eviction is not
-- theoretical: right after this query ran, get_hero_neighborhood for Batman
-- (normally 33.5 ms warm) cost 1,300 ms, because the queue had just evicted
-- the pages the RPC needed. Anon statement_timeout is 3s.
--
-- Fix: filter hero_relationships/hero_relatives rows to BOTH endpoints in the
-- fame >= 60 set (478 heroes, via heroes_fame_score_idx) before the
-- group-by, so the aggregate never sees the other ~99.5% of the edge graph.
-- Re-measured on the same live data: 1,131 ms, 5,551 buffers, no temp spill,
-- single-batch HashAggregate. Row count unchanged at 3,026 (verified
-- identical before/after this migration) -- this changes the plan, not the
-- result set.
--
-- Folds in a correctness fix (M3, 2026-07-27 review): the old
-- `least(ha.fame_score, hb.fame_score) >= 60` is NULL-permissive --
-- least(null, 70) returns 70, so a NULL-fame hero would pass the gate and
-- its NULL fame_total would sort FIRST under `desc` (Postgres's DESC default
-- is NULLS FIRST). Joining ha/hb against the pre-filtered `fame` CTE instead
-- of `heroes` makes this structurally impossible -- `fame_score >= 60` in
-- the CTE's WHERE excludes NULL by construction (NULL >= 60 is NULL, not
-- true), which is the two-predicate fix the review asked for, just enforced
-- once at the join target rather than twice in the final WHERE. Checked
-- before writing this migration: today's data has zero rows this bug
-- actually leaks (old and fixed predicates returned the same 3,055 count on
-- the pre-blurbs-exclusion set) -- this is closing a latent hole, not fixing
-- an observed one.
create or replace view public.hero_relationship_blurb_queue as
with fame as (
  -- The gate, hoisted here instead of applied post-join. Every downstream
  -- CTE only ever sees these ~478 ids, which is what keeps the edge scan and
  -- the aggregate small enough to avoid the disk spill above.
  select id, name, fame_score, publisher
  from public.heroes
  where fame_score >= 60
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
  -- min(): a pair that is both kin and ally is kin, which is the more specific
  -- fact and the better thing to write about.
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
  ha.publisher as publisher,
  case u.kind_ord when 0 then 'family' when 1 then 'enemy' else 'ally' end as kind,
  ha.fame_score + hb.fame_score as fame_total
from u
join fame ha on ha.id = u.a
join fame hb on hb.id = u.b
-- Self-loop guard. hero_relationships excludes self-pairs at build time, but
-- hero_relatives does not: 6 rows have hero_id = related_hero_id, a pre-existing
-- family-tree name-resolution bug (Hal Jordan and Black Canary among them). Those
-- collapse to a = b under least/greatest and would fail the blurbs table's
-- CHECK (hero_a < hero_b) on insert. Guarded here rather than repaired upstream:
-- hero_relatives feeds the houses/family-tree feature and is not this change's to
-- rewrite, and a character is never their own relationship regardless of source.
where u.a <> u.b
  and u.kind_ord < 3
  and ha.publisher is not distinct from hb.publisher
  and not exists (
    select 1 from public.hero_relationship_blurbs bl
    where bl.hero_a = u.a and bl.hero_b = u.b
  );

-- Deliberately NOT granted to anon or authenticated. This is an authoring tool
-- read through the service role, not app data. Granting it would expose a
-- ~400k-row aggregate producing 108k candidate pairs to the public API for no
-- product reason. (M4, 2026-07-27 review: this was previously described here
-- as "a 3,000-row scan" -- 3,000 is the post-filter result size, not the scan
-- cost; corrected in 20260727161000_relationship_blurb_queue.sql too.)
revoke all on public.hero_relationship_blurb_queue from anon, authenticated;
