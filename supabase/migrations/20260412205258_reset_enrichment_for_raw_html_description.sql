-- Reset enrichment so heroes re-fetch and store raw HTML description.
-- Targets heroes that have a plain-text description (no HTML angle brackets)
-- or no description at all, forcing a fresh ComicVine fetch.
UPDATE heroes
SET comicvine_enriched_at = NULL
WHERE description IS NULL
   OR description NOT LIKE '%<%';
;
