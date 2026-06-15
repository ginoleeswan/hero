-- Admin: delete a featured campaign by id. is_admin gated; mirrors
-- admin_delete_hero. Returns rows deleted (0 or 1). Powers the Delete action in
-- the command center's Campaigns domain.
create or replace function public.admin_delete_campaign(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  with del as (
    delete from public.featured_campaigns where id = p_id returning 1
  )
  select count(*) into v_deleted from del;
  return v_deleted;
end $$;
grant execute on function public.admin_delete_campaign(uuid) to authenticated, service_role;
