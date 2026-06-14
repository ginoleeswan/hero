-- Generic enable/disable for any pg_cron job, so the command center can stop/
-- start every cron (not just the comicvine drain) without losing its schedule.
create or replace function public.admin_toggle_cron(p_jobname text, p_enabled boolean)
returns text
language plpgsql
security definer
as $function$
declare v_id bigint;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  select jobid into v_id from cron.job where jobname = p_jobname;
  if v_id is null then
    raise exception 'no such cron job: %', p_jobname;
  end if;
  perform cron.alter_job(v_id, active := p_enabled);
  return case when p_enabled then 'enabled' else 'disabled' end;
end $function$;
