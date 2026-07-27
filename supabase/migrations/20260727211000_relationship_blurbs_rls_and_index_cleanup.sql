-- I3 (2026-07-27 review): 20260727160000's `create table if not exists`
-- claimed to be "a no-op on the live database" but omitted three things that
-- are actually live -- RLS, the public-read policy, and the author default.
-- anon holds default write grants on new tables; RLS + a read-only policy is
-- the only thing stopping public writes to hero_relationship_blurbs. Anyone
-- replaying the migration files alone (a Supabase branch, `db reset`,
-- disaster recovery) would produce a table anon can write to.
--
-- Verified live immediately before writing this migration:
--   relrowsecurity = true
--   policy "hero_relationship_blurbs are public": PERMISSIVE, role public,
--     cmd SELECT, qual true, with_check null
--   author: is_nullable = NO, column_default = 'claude'::text
-- All four statements below reproduce that exact state and are no-ops
-- against it -- re-verified after applying, see the fix report.
alter table public.hero_relationship_blurbs enable row level security;

drop policy if exists "hero_relationship_blurbs are public" on public.hero_relationship_blurbs;
create policy "hero_relationship_blurbs are public"
  on public.hero_relationship_blurbs
  for select
  to public
  using (true);

alter table public.hero_relationship_blurbs
  alter column author set default 'claude';

alter table public.hero_relationship_blurbs
  alter column author set not null;

-- M1 (2026-07-27 review): hero_relationship_blurbs_status_idx was justified
-- by a comment claiming "the authoring queue reads this on every batch to
-- skip recorded pairs" -- false. The queue's skip clause is `not exists
-- (... where bl.hero_a = u.a and bl.hero_b = u.b)`, which never references
-- status, and get_hero_neighborhood's status filter runs after a
-- (hero_a, hero_b) primary-key probe, not a status lookup. A 3-value column
-- on a table this size (~3,000 rows) gives the planner nothing a seq scan
-- doesn't already beat, so the index is pure write overhead with no reader.
-- Comment corrected in place at
-- 20260727160000_relationship_blurb_status.sql:62.
drop index if exists public.hero_relationship_blurbs_status_idx;
