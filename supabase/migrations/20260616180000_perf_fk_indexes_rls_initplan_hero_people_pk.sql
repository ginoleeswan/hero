-- Performance advisor pass: cover the unindexed foreign keys, stop RLS policies
-- from re-evaluating auth.uid() per row, and give hero_people a primary key.
-- (The two unused_index notices are intentionally left: the "unused" signal is
-- unreliable on low-traffic stats and heroes_aliases_trgm_idx backs alias search.)

-- ── 1. Covering indexes for foreign keys ─────────────────────────────────────
create index if not exists featured_campaigns_title_id_idx     on public.featured_campaigns (title_id);
create index if not exists hero_media_appearances_title_id_idx on public.hero_media_appearances (title_id);
create index if not exists hero_people_title_id_idx            on public.hero_people (title_id);
create index if not exists user_favourites_hero_id_idx         on public.user_favourites (hero_id);

-- ── 2. hero_people primary key ───────────────────────────────────────────────
-- title_id is nullable (and currently always null), so the natural-key UNIQUE
-- index (hero_id, person_name, role, coalesce(title_id,'')) can't serve as a PK.
-- Add a surrogate identity key; the dedup UNIQUE index stays as the upsert target.
alter table public.hero_people add column if not exists id bigint generated always as identity;
alter table public.hero_people add constraint hero_people_pkey primary key (id);

-- ── 3. Wrap auth.uid() so RLS evaluates it once per query, not once per row ───
-- Behaviour is identical; only the initplan changes. Roles/commands preserved.

-- user_favourites (self-scoped, authenticated)
drop policy if exists favourites_select on public.user_favourites;
create policy favourites_select on public.user_favourites
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists favourites_insert on public.user_favourites;
create policy favourites_insert on public.user_favourites
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists favourites_delete on public.user_favourites;
create policy favourites_delete on public.user_favourites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- user_profiles (self-scoped, authenticated)
drop policy if exists profiles_select on public.user_profiles;
create policy profiles_select on public.user_profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_insert on public.user_profiles;
create policy profiles_insert on public.user_profiles
  for insert to authenticated with check ((select auth.uid()) = id);

-- user_view_history (self-scoped, ALL)
drop policy if exists "Users can manage their own view history" on public.user_view_history;
create policy "Users can manage their own view history" on public.user_view_history
  for all to public using ((select auth.uid()) = user_id);

-- admin-read ops tables (is_admin gate)
drop policy if exists enrichment_runs_admin_read on public.enrichment_runs;
create policy enrichment_runs_admin_read on public.enrichment_runs
  for select to public
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

drop policy if exists api_usage_admin_read on public.api_usage;
create policy api_usage_admin_read on public.api_usage
  for select to public
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

drop policy if exists snapshots_admin_read on public.catalog_health_snapshots;
create policy snapshots_admin_read on public.catalog_health_snapshots
  for select to public
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

drop policy if exists enrichment_run_heroes_admin_read on public.enrichment_run_heroes;
create policy enrichment_run_heroes_admin_read on public.enrichment_run_heroes
  for select to public
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));
