-- Creators + story title for the issue page. ComicVine populates person_credits
-- and the issue `name` for established issues (a debut, a back issue) but not
-- brand-new ones, so these are best-effort: shown when present, absent otherwise.
-- Captured by get-comicvine-issue (read-through) and the sync-new-comics enrich
-- phase, both of which already fetch the issue detail.
alter table public.comic_issues add column if not exists creators jsonb;     -- [{ name, role }]
alter table public.comic_issues add column if not exists story_title text;   -- the issue's story name
