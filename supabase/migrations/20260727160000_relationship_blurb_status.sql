-- Relationship blurbs: record declines, not just successes.
--
-- The focus card on /social-web/[id] shows a written note on what two
-- characters actually are to each other, falling back to a templated line from
-- describeRelationship(). There are 36 written notes and ~3,000 candidate pairs.
--
-- The queue that feeds that work is drawn from hero_relationships, which derives
-- entirely from ComicVine's free-text enemies/friends/teams arrays. A meaningful
-- share of high-fame pairs in it are not relationships at all (measured: rank
-- 2000 of the fame-ranked list is Peacemaker/Optimus Prime). So "I looked at this
-- pair and there is nothing true to say" MUST be recordable, or the queue never
-- drains and the same junk resurfaces every session.
--
-- Three outcomes:
--   'written'         — a true, specific note. Renders on the card.
--   'no_relationship' — the edge is a ComicVine artifact; these two aren't tied.
--   'nothing_to_say'  — real connection, nothing to add beyond the fallback.
--
-- The 'no_relationship' rows accumulate into a curated denylist of bad edges.
-- They are recorded here but NOT yet consumed: feeding them back into
-- rebuild_hero_relationships() changes every page at once and is a separate call.

-- The table predates this file (applied via MCP, never committed). Stated here
-- so the repo describes its own schema; a no-op on the live database.
--
-- I3 (2026-07-27 review): this DDL is NOT a complete description of the live
-- schema -- it omitted the RLS lockdown, the public-read policy, and the
-- author default that are actually live. anon holds default write grants on
-- new tables, so RLS + that policy is the only thing stopping public writes;
-- a fresh apply from this file alone (a Supabase branch, `db reset`,
-- disaster recovery) would produce a table anon can write to. Fixed forward,
-- not here, in 20260727211000_relationship_blurbs_rls_and_index_cleanup.sql
-- (idempotent, verified no-op against live).
create table if not exists public.hero_relationship_blurbs (
  hero_a text not null references public.heroes(id) on delete cascade,
  hero_b text not null references public.heroes(id) on delete cascade,
  blurb text,
  author text,
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (hero_a, hero_b),
  constraint hero_relationship_blurbs_ordered check (hero_a < hero_b),
  constraint hero_relationship_blurbs_len
    check (char_length(blurb) >= 20 and char_length(blurb) <= 320)
);

alter table public.hero_relationship_blurbs
  alter column blurb drop not null;

alter table public.hero_relationship_blurbs
  add column if not exists status text not null default 'written',
  add column if not exists note text;

-- Separate statement: adding the column and constraining it in one ALTER would
-- validate the check before the default lands on existing rows.
alter table public.hero_relationship_blurbs
  drop constraint if exists hero_relationship_blurbs_status;

alter table public.hero_relationship_blurbs
  add constraint hero_relationship_blurbs_status
    check (status in ('written', 'no_relationship', 'nothing_to_say'));

-- A written row without text is the one state that would render a blank line.
alter table public.hero_relationship_blurbs
  drop constraint if exists hero_relationship_blurbs_written_has_text;

alter table public.hero_relationship_blurbs
  add constraint hero_relationship_blurbs_written_has_text
    check (status <> 'written' or blurb is not null);

-- M1 (2026-07-27 review): this index was unused and justified by a false
-- comment ("the authoring queue reads this on every batch to skip recorded
-- pairs") -- the queue's skip clause is `not exists (... where bl.hero_a =
-- u.a and bl.hero_b = u.b)`, which never references status, and the
-- get_hero_neighborhood RPC's status filter arrives after a (hero_a, hero_b)
-- primary-key probe, not a status lookup. A 3-value column on a ~3,000-row
-- table gives the planner nothing a seq scan doesn't already beat. The
-- statement below is left as applied (a historical record) per this repo's
-- rule against editing already-applied DDL; the index itself is dropped
-- forward, not here, in
-- 20260727211000_relationship_blurbs_rls_and_index_cleanup.sql.
create index if not exists hero_relationship_blurbs_status_idx
  on public.hero_relationship_blurbs (status);
