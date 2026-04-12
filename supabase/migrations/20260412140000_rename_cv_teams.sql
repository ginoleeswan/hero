-- supabase/migrations/20260412140000_rename_cv_teams.sql
ALTER TABLE heroes RENAME COLUMN cv_teams TO teams;
