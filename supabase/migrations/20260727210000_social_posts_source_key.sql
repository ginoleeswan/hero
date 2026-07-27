-- social_posts.source_key — what a queued post is ABOUT, as a stable key.
--
-- Design: docs/superpowers/specs/2026-07-27-pulse-reach-design.md §2.3
--
-- The Pulse composer runs daily and picks the best event in the feed. Events
-- outlive a day: a trailer stays a Pulse candidate for fourteen days and a surge
-- for four, so on its own "one post per day" would happily post the Doomsday
-- trailer five mornings running. The rail can repeat itself — it is a view of
-- the current state. An account that repeats itself teaches people to scroll
-- past it.
--
-- `batch`/`ord` already caps volume (one row per day, unique). This caps
-- REPETITION, which is the different and more damaging failure. Nullable and
-- unconstrained because every other generator writes rows that are about a
-- composition rather than an event, and those have no source.
--
-- Deliberately not unique: a live event's daily digest is a legitimate repeat of
-- the same event, so the composer keys those per day and the uniqueness that
-- matters is enforced by the lookback query, not the schema.

alter table public.social_posts
  add column if not exists source_key text;

comment on column public.social_posts.source_key is
  'Stable identifier for the real-world event a generated post is about (e.g. "video:tLkx4BNsSiM"). Used by the Pulse composer to avoid posting the same event twice. Null for posts composed from the catalogue rather than from an event.';

-- The only query that reads it: "have we already posted about this, recently?"
create index if not exists social_posts_source_key_created_idx
  on public.social_posts (source_key, created_at desc)
  where source_key is not null;
