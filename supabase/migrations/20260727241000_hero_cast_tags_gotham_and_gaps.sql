-- Two corrections found by checking the cast tags against 200 authored decisions.
--
-- 1. bat-family and gotham-rogues are one cast. Splitting them cost real pairs:
--    Alfred/Joker, Alfred/Bane, Batgirl/Bane, Joker/Batgirl, Nightwing/Bane were
--    all written and would have read as cross-cast. Alfred has patched up every
--    injury the Joker inflicted; that is the same book, not two.
--    Measured: adding this lifts recall 66% -> 73% (precision 77% -> 71%).
--
-- 2. Hera had no tag at all — she is fame 98, in the queue, and paired with
--    Aphrodite. A missed tag is invisible unless something checks for it, which
--    is what hero_cast_untagged below exists to do.

insert into public.hero_cast_tags (hero_id, cast_tag)
select unnest(ids), tag from (values
  ('gotham', array['69','17','cv-1691','63','549','cv-1690','cv-3727','h_15a572bc-4624-4fe9-9dff-1eff9a94781b','h_ecba928f-1888-4f64-8330-c727dbf19c65','370','309','165','cv-4885','cv-3718','678','cv-6129','522','cv-3726','cv-3725','cv-3715','538','h_c641fc32-86de-4e33-a5e9-0a7daa34d10f','214','cv-3588']),
  ('greek-myth', array['h_2704ac68-9389-46e8-ad4e-b847d94d53d4'])
) t(tag, ids)
where exists (select 1 from public.heroes h where h.id = any(t.ids))
on conflict do nothing;

delete from public.hero_cast_tags t
where not exists (select 1 from public.heroes h where h.id = t.hero_id);

-- Visibility, not a filter. A hero who reaches the authoring queue with no cast
-- tag would silently look cross-cast against everyone and sink to the bottom of
-- every ordering — the failure mode that hid Hera. This makes that state
-- queryable instead of invisible.
create or replace view public.hero_cast_untagged as
select h.id, h.name, h.publisher, h.fame_score
from public.heroes h
where h.fame_score >= 60
  and not exists (select 1 from public.hero_cast_tags t where t.hero_id = h.id);

revoke all on public.hero_cast_untagged from anon, authenticated;
