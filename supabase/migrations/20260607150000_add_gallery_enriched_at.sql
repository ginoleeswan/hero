-- Gallery enrichment sentinel: lets us distinguish "never fetched" from
-- "fetched, ComicVine had no art/covers" so no-art heroes don't re-fetch
-- (~21 ComicVine calls) on every character-screen visit.
alter table heroes
  add column if not exists gallery_enriched_at timestamptz;
