-- ComicVine collision gate (issue #65): a new `needs_review` status for heroes
-- whose exact-name ComicVine match has a disagreeing publisher (or ambiguous
-- same-name candidates). The enrich-comicvine-batch / get-comicvine-hero
-- functions now route those there WITHOUT writing data, and an admin queue
-- resolves them. See supabase/functions/_shared/comicvineMatch.ts.

-- 1. Allow the new status value.
alter table public.heroes
  drop constraint if exists heroes_comicvine_status_check;
alter table public.heroes
  add constraint heroes_comicvine_status_check
  check (comicvine_status = any (array[
    'pending'::text, 'done'::text, 'empty'::text,
    'failed'::text, 'unmatched'::text, 'needs_review'::text
  ]));

-- 2. Partial index so the admin queue's "list needs_review" scan is cheap
--    (mirrors 20260713140000_index_heroes_comicvine_status_pending.sql).
create index if not exists heroes_comicvine_status_needs_review_idx
  on public.heroes (comicvine_status)
  where comicvine_status = 'needs_review';

-- 3. One-time audit sweep of the historical debt. Hand-curated rows (non `cv-`
--    id) that carry a Marvel/DC publisher next to a real franchise are almost
--    certainly cross-franchise collisions — a game/anime character that absorbed
--    a same-name comic character's data (e.g. "Baymax" franchise Final Fantasy →
--    Marvel id 5023). This only RE-FLAGS them for human review; it does NOT
--    revert their data. The admin either re-confirms (accept → re-enrich from the
--    right id) or corrects. Count verified ≈ 83 before running.
update public.heroes
set comicvine_status = 'needs_review'
where comicvine_status = 'done'
  and id not like 'cv-%'
  and (publisher ilike '%marvel%' or publisher ilike '%dc comics%' or publisher = 'DC')
  and franchise is not null;
