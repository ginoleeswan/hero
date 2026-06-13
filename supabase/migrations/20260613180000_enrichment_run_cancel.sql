-- Cancellable runs: the batch checks cancel_requested between heroes and stops,
-- finalising the run as 'stopped'. admin_stop_run sets the flag (admin-only).
alter table enrichment_runs add column if not exists cancel_requested boolean not null default false;

create or replace function admin_stop_run(p_run_id bigint)
returns boolean language plpgsql security definer as $$
declare n int;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update enrichment_runs set cancel_requested = true
   where id = p_run_id and status = 'running';
  get diagnostics n = row_count;
  return n > 0;
end $$;
