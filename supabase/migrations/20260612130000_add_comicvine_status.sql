-- Phase 1 of decoupling the character screen from ComicVine on the read path.
--
-- Problem: the client's refetch gate (`needsComicVine`) ORs on individual content
-- fields being null (powers, movies, first_issue_*). ComicVine legitimately
-- returns null for civilians with no powers/movies, so those nulls never flip and
-- the row re-fetches ~13 ComicVine calls on EVERY view, forever. ~97% of heroes
-- were in this state.
--
-- Fix: a terminal status column so an enrichment attempt is recorded even when it
-- yields empty data. The client then gates on status, not field-nullness.
--
--   pending  -> never attempted (or queued for refresh)
--   done     -> ComicVine matched and detail fields written (some may be null — fine)
--   empty    -> reserved: matched but ComicVine had no usable detail data
--   failed   -> no character matched by name / fetch error; do not auto-retry on read

alter table public.heroes
  add column if not exists comicvine_status text
    check (comicvine_status in ('pending', 'done', 'empty', 'failed'));

-- Backfill: a set enrichment timestamp means we already pulled detail fields.
update public.heroes
set comicvine_status = case
      when comicvine_enriched_at is not null then 'done'
      else 'pending'
    end
where comicvine_status is null;

alter table public.heroes
  alter column comicvine_status set default 'pending';
