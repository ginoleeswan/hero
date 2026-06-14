-- Admin: remove a hero from the catalogue by id. Used by the "Add heroes" panel
-- so a just-added character can be undone if it was the wrong match. Admin-gated;
-- mirrors admin_add_comicvine_heroes. Returns the number of rows deleted (0 or 1).
create or replace function public.admin_delete_hero(p_hero_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare v_deleted integer;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  with del as (
    delete from public.heroes where id = p_hero_id returning 1
  )
  select count(*) into v_deleted from del;
  return v_deleted;
end $function$;
