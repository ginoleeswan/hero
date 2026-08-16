-- admin_cron_status returned each job's name, schedule, active flag and the
-- status of its last pg_cron run. For the fourteen jobs that only queue an HTTP
-- POST that last field is always 'succeeded', so the command center's green dot
-- carried no information about whether the work happened. And nothing anywhere
-- reported what a job COST — refresh-explore-bundle was averaging 24.6 seconds
-- an hour and the only way to discover that was to query pg_cron by hand.
--
-- Both are now in the payload:
--
--   last_ms / avg_ms_7d      how long the job takes, and whether that is normal
--   runs_24h / fails_24h     pg_cron's own view — did it run, did it error
--   http_status / http_at    the edge function's actual response code
--   http_fails_24h           non-2xx or timed-out responses in the last day
--
-- http_* is null for the seven jobs that run SQL directly, which is correct
-- rather than missing: there is no HTTP call to have an outcome. Existing fields
-- keep their names and meanings, so the current UI carries on working while it
-- is updated to show the new ones.

create or replace function public.admin_cron_status()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'jobname',        j.jobname,
      'schedule',       j.schedule,
      'active',         j.active,
      'lim',            (regexp_match(j.command, '''limit'',\s*([0-9]+)'))[1]::int,
      'last_run',       d.start_time,
      'last_status',    d.status,
      'last_ms',        d.ms,
      'avg_ms_7d',      w.avg_ms,
      'runs_24h',       w.runs_24h,
      'fails_24h',      w.fails_24h,
      'http_status',    e.status_code,
      'http_at',        e.queued_at,
      'http_fails_24h', e.fails_24h
    ) order by j.jobname), '[]'::jsonb)
    from cron.job j

    -- The most recent run, with its wall-clock duration.
    left join lateral (
      select d.start_time, d.status,
             round(extract(epoch from (d.end_time - d.start_time)) * 1000)::int as ms
      from cron.job_run_details d
      where d.jobid = j.jobid
      order by d.start_time desc
      limit 1
    ) d on true

    -- Recent behaviour. The average is over a week so a single slow night does
    -- not look like a regression; the counts are over a day so a job that has
    -- just started failing is visible today.
    left join lateral (
      select round(avg(extract(epoch from (r.end_time - r.start_time)) * 1000))::int as avg_ms,
             count(*) filter (where r.start_time > now() - interval '24 hours')                             as runs_24h,
             count(*) filter (where r.start_time > now() - interval '24 hours' and r.status <> 'succeeded') as fails_24h
      from cron.job_run_details r
      where r.jobid = j.jobid
        and r.start_time > now() - interval '7 days'
    ) w on true

    -- What the edge function actually answered. Null for SQL-only jobs.
    left join lateral (
      select last.status_code, last.queued_at, agg.fails_24h
      from (
        select i.status_code, i.queued_at
        from public.edge_invocations i
        where i.jobname = j.jobname and i.settled_at is not null
        order by i.queued_at desc
        limit 1
      ) last,
      lateral (
        select count(*)::int as fails_24h
        from public.edge_invocations i2
        where i2.jobname = j.jobname
          and i2.queued_at > now() - interval '24 hours'
          and (i2.timed_out or i2.status_code not between 200 and 299)
      ) agg
    ) e on true
  );
end;
$function$;;
