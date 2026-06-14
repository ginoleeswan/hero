-- Let the command center reconfigure a cron's cadence + batch size, not just
-- start/stop it. admin_reschedule_cron rebuilds the job in place: it keeps the
-- job's existing command (edge-function URL + vault auth), swaps the `limit`
-- value inside it, and re-schedules under the same name with the new cadence —
-- preserving the paused/active state. admin_cron_status now also returns the
-- parsed limit so the UI can show the current batch size.

create or replace function admin_cron_status()
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'jobname', j.jobname, 'schedule', j.schedule, 'active', j.active,
      'lim', (regexp_match(j.command, '''limit'',\s*([0-9]+)'))[1]::int,
      'last_run', d.start_time, 'last_status', d.status
    ) order by j.jobname), '[]'::jsonb)
    from cron.job j
    left join lateral (
      select start_time, status from cron.job_run_details d
      where d.jobid = j.jobid order by start_time desc limit 1
    ) d on true
  );
end $$;

create or replace function public.admin_reschedule_cron(
  p_jobname text,
  p_schedule text,
  p_limit integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cmd text;
  v_active boolean;
  v_id bigint;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  -- Light validation: a standard 5-field cron expression.
  if coalesce(array_length(regexp_split_to_array(btrim(p_schedule), '\s+'), 1), 0) <> 5 then
    raise exception 'invalid cron schedule: %', p_schedule;
  end if;

  select command, active into v_cmd, v_active from cron.job where jobname = p_jobname;
  if v_cmd is null then
    raise exception 'no such cron job: %', p_jobname;
  end if;

  -- Swap the batch size inside the existing command, if the job carries one.
  if p_limit is not null then
    v_cmd := regexp_replace(
      v_cmd,
      '''limit'',\s*[0-9]+',
      '''limit'', ' || greatest(1, least(p_limit, 50))::text
    );
  end if;

  perform cron.schedule(p_jobname, p_schedule, v_cmd);
  -- cron.schedule re-activates the job; restore its prior paused/active state.
  select jobid into v_id from cron.job where jobname = p_jobname;
  perform cron.alter_job(v_id, active := v_active);
  return 'rescheduled';
end $function$;
