-- Per-issue synopsis for the issue page. ComicVine's issue DETAIL endpoint
-- carries a real `description` (rate-limited, so backfilled slowly by the
-- sync-new-comics enrich phase — a few per run, famous issues first). Plaintext;
-- the function strips ComicVine's HTML before storing.
alter table public.comic_issues add column if not exists description text;
