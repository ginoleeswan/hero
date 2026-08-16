-- Nothing in this database has ever deleted anything, and three tables exist
-- only to record that work happened. Measured today:
--
--   cron.job_run_details   11,322 rows since 10 Jul — 5,643 already past 30 days
--   enrichment_runs        20,987 rows since 13 Jun — none past 90 days
--   api_usage              13,288 rows since 13 Jun — none past 90 days
--
-- Only the first is actually a problem. pg_cron writes a row per job per run and
-- never removes one: at ~300 rows a day that is roughly 64 MB a year, on a
-- 500 MB cap. The other two are 64 days old because the project is 64 days old,
-- so a 90-day window deletes nothing today. That is the point — this is a bound
-- being put in place before it is needed, not a cleanup.
--
-- Windows are chosen from what each log is FOR, not from a round number:
--
--   30 days for cron runs      — long enough to see two runs of a weekly job,
--                                which is the longest cadence scheduled.
--   90 days for enrichment     — the command center's Runs dashboard reads it,
--                                and a quarter is the span over which "has this
--                                pipeline stalled" is a meaningful question.
--   90 days for api_usage      — it tracks external quota against monthly
--                                ComicVine/TMDB limits; three cycles is ample.
--
-- enrichment_run_heroes is not listed because its run_id FK is ON DELETE
-- CASCADE, so it follows enrichment_runs down automatically.
--
-- Returns what it removed rather than running silently, so nightly_maintenance
-- can put the counts in the Postgres log and a prune that starts eating real
-- data is visible rather than inferred from a shrinking table.

create or replace function public.prune_operational_logs()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cron int := 0;
  v_runs int := 0;
  v_api  int := 0;
begin
  delete from cron.job_run_details where start_time < now() - interval '30 days';
  get diagnostics v_cron = row_count;

  delete from public.enrichment_runs where created_at < now() - interval '90 days';
  get diagnostics v_runs = row_count;

  delete from public.api_usage where created_at < now() - interval '90 days';
  get diagnostics v_api = row_count;

  raise notice 'prune_operational_logs: cron=% enrichment_runs=% api_usage=%',
    v_cron, v_runs, v_api;

  return jsonb_build_object(
    'cron_job_run_details', v_cron,
    'enrichment_runs',      v_runs,
    'api_usage',            v_api
  );
end;
$function$;

revoke execute on function public.prune_operational_logs() from anon, authenticated, public;
grant execute on function public.prune_operational_logs() to service_role;

-- Folded into the existing nightly job rather than given a cron of its own.
-- Twenty-one scheduled jobs is already the problem; housekeeping that runs once
-- a day belongs inside the thing that already runs once a day.
create or replace function public.nightly_maintenance()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.rebuild_hero_relationships();
  perform public.link_tmdb_cast();
  perform public.snapshot_catalog_health();
  perform public.prune_operational_logs();
  -- A full metrics refresh after the night's work, so the morning view is exact
  -- regardless of where the six-hourly catalogue refresh last landed.
  perform public.refresh_admin_metrics('all');
end $function$;;
