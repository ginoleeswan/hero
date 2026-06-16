-- Fix: admin_add_comicvine_heroes raised "column reference id is ambiguous".
-- The RETURNS TABLE(id, comicvine_id) output columns shadow the real columns in
-- `where id = auth.uid()`, `on conflict (comicvine_id)`, etc. Tell plpgsql to
-- resolve bare names to columns, and qualify the admin check, so the add works.
create or replace function public.admin_add_comicvine_heroes(p_heroes jsonb)
returns table (id text, comicvine_id text)
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
begin
  if not exists (select 1 from user_profiles where user_profiles.id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  return query
    insert into public.heroes (id, name, comicvine_id, image_url, comicvine_status)
    select 'h_' || gen_random_uuid(), e->>'name', e->>'id', nullif(e->>'image', ''), 'pending'
    from jsonb_array_elements(p_heroes) e
    where coalesce(e->>'id', '') <> '' and coalesce(e->>'name', '') <> ''
    on conflict (comicvine_id) do nothing
    returning heroes.id, heroes.comicvine_id;
end $function$;
