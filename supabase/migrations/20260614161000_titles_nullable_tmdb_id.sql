-- tmdb_id is a transitional column from the films->titles rename. It must be
-- nullable now: igdb game rows have no tmdb_id, and wikidata-sourced appearance
-- edges key on title_id, not tmdb_id.
alter table public.titles alter column tmdb_id drop not null;
alter table public.hero_media_appearances alter column tmdb_id drop not null;
