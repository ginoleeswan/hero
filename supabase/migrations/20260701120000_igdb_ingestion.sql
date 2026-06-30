-- supabase/migrations/20260701120000_igdb_ingestion.sql
-- IGDB game-universe ingestion: per-source id + status on heroes, plus an
-- admin-only ingestion-state table mirroring cv_ingestion_state.

alter table public.heroes add column if not exists igdb_id text;
alter table public.heroes add column if not exists igdb_status text;

create unique index if not exists heroes_igdb_id_key
  on public.heroes (igdb_id)
  where igdb_id is not null;

create table if not exists public.igdb_ingestion_state (
  franchise        text primary key,
  publisher        text not null,
  igdb_franchise_id bigint,
  status           text not null default 'pending',
  last_synced_at   timestamptz,
  inserted         int not null default 0,
  rehomed          int not null default 0,
  skipped          int not null default 0
);

-- Admin-only: RLS enabled with NO public policy (anon/auth read nothing).
alter table public.igdb_ingestion_state enable row level security;
