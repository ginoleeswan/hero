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

-- The authoring queue reads this on every batch to skip recorded pairs.
create index if not exists hero_relationship_blurbs_status_idx
  on public.hero_relationship_blurbs (status);
