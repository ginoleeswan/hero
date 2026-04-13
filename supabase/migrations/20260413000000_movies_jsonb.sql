-- Change movies from text[] to jsonb[] to store { name, year, imageUrl } objects.
-- Existing text[] data is cleared (enrichment re-runs on next character page visit).
ALTER TABLE heroes
  ALTER COLUMN movies TYPE jsonb[] USING ARRAY[]::jsonb[],
  ADD COLUMN IF NOT EXISTS movie_count integer;
