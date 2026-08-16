-- Point all fourteen posting jobs at invoke_edge_function.
--
-- Beyond the observability this buys (see the previous migration), the commands
-- themselves were fourteen near-identical twelve-line blobs that had drifted:
-- some read the project URL and service-role key from the vault, others
-- hardcoded the URL and pasted an anon JWT inline. Adding a job meant copying
-- whichever neighbour you happened to look at. Now each is one line naming a
-- function and its arguments, and the URL, the key, the timeout, and the
-- record-keeping live in one place where changing them changes them everywhere.
--
-- Two deliberate details:
--   * `triggeredBy: 'cron'` is dropped from every body — invoke_edge_function
--     adds it, and leaving it in both places is how the two versions diverge.
--   * the `'limit', N` literal is preserved verbatim wherever it existed,
--     because admin_reschedule_cron rewrites batch sizes with a regex against
--     exactly that text. The command center's batch-size editor keeps working.
--
-- Schedules and paused/active state are untouched: alter_job changes only the
-- command.

do $$
declare
  t record;
  v_id bigint;
begin
  for t in
    select * from (values
      ('enrich-comicvine-pending',   'enrich-comicvine-batch', $b$jsonb_build_object('limit', 25)$b$),
      ('enrich-tmdb-pending',        'enrich-tmdb-batch',      $b$jsonb_build_object('limit', 50)$b$),
      ('enrich-wikidata-pending',    'enrich-wikidata-batch',  $b$jsonb_build_object('limit', 25)$b$),
      ('resolve-enwiki-title-drain', 'resolve-enwiki-title',   $b$jsonb_build_object('limit', 300)$b$),
      ('sync-wiki-pageviews-cycle',  'sync-wiki-pageviews',    $b$jsonb_build_object('limit', 120)$b$),
      ('verify-issue-cast-daily',    'verify-issue-cast',      $b$jsonb_build_object('limit', 40, 'days', 30)$b$),
      ('sync-new-comics-hourly',     'sync-new-comics',        $b$jsonb_build_object('days', 14, 'maxVolumes', 10)$b$),
      ('sync-tmdb-slate-weekly',     'sync-tmdb-slate',        $b$jsonb_build_object('maxPages', 10)$b$),
      ('sync-tmdb-trending-daily',   'sync-tmdb-trending',     $b$jsonb_build_object('pages', 2)$b$),
      ('pull-social-stats-nightly',  'pull-social-stats',      $b$'{}'::jsonb$b$),
      ('send-daily-push',            'send-daily-push',        $b$'{}'::jsonb$b$),
      ('sync-channel-videos-hourly', 'sync-channel-videos',    $b$'{}'::jsonb$b$),
      ('sync-title-videos-hourly',   'sync-title-videos',      $b$'{}'::jsonb$b$),
      ('sync-watched-events',        'sync-watched-events',    $b$'{}'::jsonb$b$)
    ) as v(jobname, fn, body)
  loop
    select jobid into v_id from cron.job where jobname = t.jobname;
    if v_id is null then
      raise notice 'skipped % — no such job', t.jobname;
      continue;
    end if;
    perform cron.alter_job(
      v_id,
      command := format(
        'select public.invoke_edge_function(%L, %s, %L);',
        t.fn, t.body, t.jobname
      )
    );
  end loop;
end $$;

-- The invocation log is bounded like the others. 14 jobs at their current
-- cadences is roughly 900 rows a day, so 30 days holds it at about 27,000.
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
  v_inv  int := 0;
begin
  delete from cron.job_run_details where start_time < now() - interval '30 days';
  get diagnostics v_cron = row_count;

  delete from public.enrichment_runs where created_at < now() - interval '90 days';
  get diagnostics v_runs = row_count;

  delete from public.api_usage where created_at < now() - interval '90 days';
  get diagnostics v_api = row_count;

  delete from public.edge_invocations where queued_at < now() - interval '30 days';
  get diagnostics v_inv = row_count;

  raise notice 'prune_operational_logs: cron=% enrichment_runs=% api_usage=% edge_invocations=%',
    v_cron, v_runs, v_api, v_inv;

  return jsonb_build_object(
    'cron_job_run_details', v_cron,
    'enrichment_runs',      v_runs,
    'api_usage',            v_api,
    'edge_invocations',     v_inv
  );
end;
$function$;;
