-- Harden SECURITY DEFINER RPCs and the verdicts cache policies (defense in depth).
--
-- Context: every SECURITY DEFINER function in `public` carried Postgres' default
-- PUBLIC execute grant, so `anon` (a logged-out visitor) could invoke all of
-- them. The admin_* RPCs self-protect with an is_admin guard, but:
--   * resolve_hero_qid / mark_hero_unresolved had NO guard yet are reachable by
--     any authenticated user and mutate heroes.* directly; and
--   * several functions never pinned search_path — the classic SECURITY DEFINER
--     privilege-escalation vector.
--
-- This migration does not change any function's behaviour beyond adding the two
-- missing admin guards. Resulting access policy:
--   * admin_* RPCs (self-guarded)          -> authenticated, service_role
--   * resolve_hero_qid / mark_unresolved   -> authenticated, service_role (+ guard added)
--   * pipeline mutators (service-only)     -> service_role only
--   * all of the above                     -> REVOKE from PUBLIC + anon; search_path = public
--
-- Callers verified before tightening:
--   * Admin RPCs + the two wikidata mutators are invoked from the admin
--     catalog-health console (src/lib/db/catalogHealth.ts, campaigns.ts,
--     cvIngest.ts) as the authenticated admin account.
--   * cache_hero_comicvine_data / register_film_match / register_media_match /
--     snapshot_catalog_health are only ever called by edge functions and cron,
--     all of which authenticate with SUPABASE_SERVICE_ROLE_KEY.
--   * rls_auto_enable is an event-trigger function and is intentionally untouched.

-- ── 1. Pin search_path on the SECURITY DEFINER functions that lacked it ───────
alter function public.admin_cron_status()                 set search_path = public;
alter function public.admin_reenrich_hero(text)           set search_path = public;
alter function public.admin_retry_failed()                set search_path = public;
alter function public.admin_run_drain(integer)            set search_path = public;
alter function public.admin_run_wikidata_enrich(integer)  set search_path = public;
alter function public.admin_run_wikidata_resolve(integer) set search_path = public;
alter function public.admin_set_drain_cron(boolean)       set search_path = public;
alter function public.admin_snapshot_now()                set search_path = public;
alter function public.admin_stop_run(bigint)              set search_path = public;
alter function public.admin_toggle_cron(text, boolean)    set search_path = public;
alter function public.snapshot_catalog_health()           set search_path = public;

-- ── 2. Add the missing admin guard to the two client-facing wikidata mutators ─
-- Bodies are unchanged from the live definitions; only the is_admin guard is
-- prepended so they match every other admin RPC.
create or replace function public.resolve_hero_qid(p_hero_id text, p_qid text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update public.heroes
     set wikidata_qid = p_qid,
         wikidata_status = 'resolved',
         wikidata_candidates = null
   where id = p_hero_id;
end;
$function$;

create or replace function public.mark_hero_unresolved(p_hero_id text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update public.heroes
     set wikidata_status = 'unresolved',
         wikidata_candidates = null
   where id = p_hero_id;
end;
$function$;

-- ── 3a. Admin + admin-gated RPCs: authenticated admins (the guard enforces ────
--        is_admin at runtime) and service_role. Revoke the default PUBLIC + anon.
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_add_comicvine_heroes(jsonb)',
    'public.admin_cron_status()',
    'public.admin_delete_campaign(uuid)',
    'public.admin_delete_hero(text)',
    'public.admin_reenrich_hero(text)',
    'public.admin_reschedule_cron(text, text, integer)',
    'public.admin_retry_failed()',
    'public.admin_run_drain(integer)',
    'public.admin_run_wikidata_enrich(integer)',
    'public.admin_run_wikidata_resolve(integer)',
    'public.admin_set_drain_cron(boolean)',
    'public.admin_snapshot_now()',
    'public.admin_stop_run(bigint)',
    'public.admin_toggle_cron(text, boolean)',
    'public.admin_upsert_campaign(text, text, timestamptz, uuid, text, text, text, text, text[], integer, timestamptz)',
    'public.resolve_hero_qid(text, text)',
    'public.mark_hero_unresolved(text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end $$;

-- ── 3b. Pipeline mutators: only ever invoked by edge functions / cron as ──────
--        service_role. Revoke PUBLIC, anon AND authenticated.
do $$
declare f text;
begin
  foreach f in array array[
    'public.cache_hero_comicvine_data(text, text, text[])',
    'public.register_film_match(text, text, text, text)',
    'public.register_media_match(text, text, text, text, text)',
    'public.snapshot_catalog_health()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end $$;

-- ── 4. verdicts cache: scope the always-true policies to authenticated ────────
-- The app is auth-gated, so anonymous writes are never legitimate. Shared-cache
-- semantics are preserved (any signed-in user may read and seed a row); there is
-- intentionally still no UPDATE policy, so rows stay insert-once.
drop policy if exists verdicts_select on public.verdicts;
drop policy if exists verdicts_insert on public.verdicts;

create policy verdicts_select on public.verdicts
  for select to authenticated using (true);

create policy verdicts_insert on public.verdicts
  for insert to authenticated with check (true);

-- ── 5. rls_auto_enable: event-trigger helper (ensure_rls, ddl_command_end) ────
-- It is never meant to be invoked over the REST RPC surface; event triggers fire
-- regardless of EXECUTE grants, so revoking the default PUBLIC grant is safe.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
