-- Admin-callable wrapper so the command center can refresh fame scores on demand
-- (e.g. right after a build batch) without waiting for the weekly cron. refresh_fame
-- itself is service-role-only; this definer wrapper runs as owner and is gated to
-- admins, mirroring the other admin_run_* RPCs.
create or replace function public.admin_refresh_fame()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  return public.refresh_fame();
end $$;

revoke all on function public.admin_refresh_fame() from public, anon;
grant execute on function public.admin_refresh_fame() to authenticated;
