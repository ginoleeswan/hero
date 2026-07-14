-- Second slow query on the admin command-center home: listUnbrandedHeroes did a
-- full seq scan of the 197MB heroes heap (~7s cold) to find the ~hundreds of
-- "unbranded but ComicVine-done" heroes, sort them by issue_count, and take 300.
-- A partial index matching that exact predicate, ordered by issue_count, turns it
-- into a tiny index scan (a few hundred entries) + ~300 heap fetches.
-- Predicate mirrors src/lib/db/catalogHealth.ts listUnbrandedHeroes /
-- UNBRANDED_BUCKETS exactly, so the planner can use it.
create index if not exists heroes_unbranded_worklist_idx
  on public.heroes (issue_count desc nulls last)
  where comicvine_status = 'done'
    and (publisher is null or publisher in ('Company-Licensed', 'Creator-Owned'));
