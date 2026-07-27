-- The remaining blurb-authoring work, as a view.
--
-- A view, not a frozen list, so authoring is resumable with no bookkeeping: it
-- excludes every pair already recorded in hero_relationship_blurbs (ANY status,
-- including declines), so a later session just reads it and continues.
--
-- Three filters, each measured 2026-07-27:
--
--   Non-teammate only. Teammate edges exist BECAUSE the two share a named
--   roster, so describeRelationship() already emits something true and specific
--   ("Served alongside Storm in the X-Men"). A blurb there mostly restates it.
--   Excluding them drops 2,388 pairs at this fame gate.
--
--   Both fame >= 60. Yields 3,833 non-teammate pairs; >= 50 would add 254 and
--   >= 40 would add 4,813, at falling quality.
--
--   Same publisher. Removes 775 pairs that are overwhelmingly name-collision
--   artifacts — the Peacemaker/Optimus Prime class. Leaves 3,058.
--
-- The view SELECTS candidates; it does not CERTIFY them. Same-publisher junk
-- survives it (Rocket Raccoon/Venom, both Marvel, not allies in any sense).
-- That residue is what the decline path in hero_relationship_blurbs.status is
-- for. Expect a real decline rate and do not treat it as failure.
--
-- No ORDER BY here: ordering belongs to the consuming query. Read it with
--   select * from public.hero_relationship_blurb_queue
--   order by fame_total desc, name_a limit 100;
create or replace view public.hero_relationship_blurb_queue as
with e as (
  select least(r.hero_id, r.related_id) as a,
         greatest(r.hero_id, r.related_id) as b,
         min(case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end) as kind_ord
  from public.hero_relationships r
  where r.source is distinct from 'curated'
  group by 1, 2
),
f as (
  select least(hero_id, related_hero_id) as a,
         greatest(hero_id, related_hero_id) as b,
         0 as kind_ord
  from public.hero_relatives
  where related_hero_id is not null
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
join public.heroes ha on ha.id = u.a
join public.heroes hb on hb.id = u.b
-- Self-loop guard. hero_relationships excludes self-pairs at build time, but
-- hero_relatives does not: 6 rows have hero_id = related_hero_id, a pre-existing
-- family-tree name-resolution bug (Hal Jordan and Black Canary among them). Those
-- collapse to a = b under least/greatest and would fail the blurbs table's
-- CHECK (hero_a < hero_b) on insert. Guarded here rather than repaired upstream:
-- hero_relatives feeds the houses/family-tree feature and is not this change's to
-- rewrite, and a character is never their own relationship regardless of source.
where u.a <> u.b
  and u.kind_ord < 3
  and least(ha.fame_score, hb.fame_score) >= 60
  and ha.publisher is not distinct from hb.publisher
  and not exists (
    select 1 from public.hero_relationship_blurbs bl
    where bl.hero_a = u.a and bl.hero_b = u.b
  );

-- Deliberately NOT granted to anon or authenticated. This is an authoring tool
-- read through the service role, not app data. Granting it would expose a
-- 3,000-row scan on a hot table to the public API for no product reason.
revoke all on public.hero_relationship_blurb_queue from anon, authenticated;
