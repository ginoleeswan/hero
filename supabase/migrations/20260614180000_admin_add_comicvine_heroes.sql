-- Admin ingestion: add ComicVine characters to the catalogue as 'pending' so
-- they flow into the ComicVine enrich drain (step 1). Takes a jsonb array of
-- { id, name, image }. Returns how many new heroes were inserted.
create or replace function public.admin_add_comicvine_heroes(p_heroes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare v_added integer;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  with ins as (
    insert into public.heroes (id, name, comicvine_id, image_url, comicvine_status)
    select 'cv-' || (e->>'id'),
           e->>'name',
           e->>'id',
           nullif(e->>'image', ''),
           'pending'
    from jsonb_array_elements(p_heroes) e
    where coalesce(e->>'id', '') <> '' and coalesce(e->>'name', '') <> ''
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into v_added from ins;
  return v_added;
end $function$;
