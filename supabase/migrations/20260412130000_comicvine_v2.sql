-- supabase/migrations/20260412130000_comicvine_v2.sql
ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS issue_count integer,
  ADD COLUMN IF NOT EXISTS creators text[],
  ADD COLUMN IF NOT EXISTS enemies text[],
  ADD COLUMN IF NOT EXISTS friends text[],
  ADD COLUMN IF NOT EXISTS movies text[],
  ADD COLUMN IF NOT EXISTS cv_teams text[];
