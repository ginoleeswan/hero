-- supabase/migrations/20260412120000_add_hero_powers.sql
ALTER TABLE heroes ADD COLUMN powers text[] NULL;
