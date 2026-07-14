-- Performance-advisor cleanup (all behavior-preserving).
--
-- 1. auth_rls_initplan: RLS policies calling bare auth.uid() re-evaluate it for
--    every row. Wrapping as (select auth.uid()) makes Postgres evaluate it once
--    per query (an InitPlan). Identical semantics, faster at scale.
-- 2. multiple_permissive_policies: matchup_votes / team_battle_votes each had a
--    redundant *_own_select (SELECT) policy that the *_own_write (ALL) policy
--    already covers with the identical condition and role — drop the redundant one.
-- 3. unused_index: drop three never-scanned indexes that only cost write overhead
--    (none back a foreign key; page_views is the hottest write path here).

-- ── 1. wrap auth.uid() in the flagged policies ──────────────────────────────
alter policy contributions_own_select on public.contributions
  using (user_id = (select auth.uid()));

alter policy takes_own_delete on public.matchup_takes
  using (user_id = (select auth.uid()));

alter policy takes_public_read on public.matchup_takes
  using ((status = 'visible'::text) or (user_id = (select auth.uid())));

alter policy matchup_votes_own_write on public.matchup_votes
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy reports_own_select on public.reports
  using (user_id = (select auth.uid()));

alter policy team_battle_votes_own_write on public.team_battle_votes
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy platform_credentials_admin_all on public.platform_credentials
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin))
  with check (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

alter policy social_posts_admin_read on public.social_posts
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

alter policy social_posts_admin_update on public.social_posts
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin))
  with check (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

alter policy social_post_results_admin_read on public.social_post_results
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

alter policy social_post_results_admin_insert on public.social_post_results
  with check (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

alter policy social_post_results_admin_update on public.social_post_results
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin))
  with check (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

-- ── 2. drop redundant SELECT policies (own_write ALL already covers SELECT) ──
drop policy if exists matchup_votes_own_select on public.matchup_votes;
drop policy if exists team_battle_votes_own_select on public.team_battle_votes;

-- ── 3. drop never-used indexes (no FK dependency) ───────────────────────────
drop index if exists public.page_views_route_idx;
drop index if exists public.page_views_session_idx;
drop index if exists public.client_errors_kind_idx;
