-- Security hardening before web launch (Supabase advisor findings).
--
-- 1) Internal / cron-only functions were executable by anon+authenticated via
--    /rest/v1/rpc/* (Postgres grants EXECUTE to PUBLIC by default). Revoke so
--    only postgres (pg_cron) and service_role can run them. Trigger firing is
--    unaffected — triggers don't check the caller's EXECUTE privilege.
revoke execute on function public.nightly_maintenance() from public, anon, authenticated;
revoke execute on function public.link_tmdb_cast() from public, anon, authenticated;
revoke execute on function public._notify_report_insert() from public, anon, authenticated;

-- Admin-panel RPC: internally is_admin-gated, but anon has no business calling
-- it at all. authenticated keeps EXECUTE (the gate authorizes).
revoke execute on function public.admin_recent_client_errors(integer, integer) from public, anon;

-- 2) Pin search_path on functions flagged with a role-mutable search_path.
--    None take table names as input, so risk was low, but pinning is free.
alter function public._report_reason_ok(text, text) set search_path = public;
alter function public.compute_fame_score(smallint, real, real, real) set search_path = public;
alter function public.get_active_campaigns(integer, integer) set search_path = public;
alter function public.get_trending_titles(text, integer, integer) set search_path = public;
alter function public.get_new_comics(integer, integer, integer, integer) set search_path = public;
alter function public.get_trending_on_screen(integer, integer) set search_path = public;
alter function public.get_trending_heroes_wiki(integer, integer) set search_path = public;
alter function public.get_debuts_this_month(integer, integer, integer) set search_path = public;
