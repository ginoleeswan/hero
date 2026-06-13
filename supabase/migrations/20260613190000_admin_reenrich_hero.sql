-- Re-fetch one hero's ComicVine data on demand (admin-only) for the hero console.
create or replace function admin_reenrich_hero(p_id text)
returns text language plpgsql security definer as $$
declare v_url text; v_key text; v_name text;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  select name into v_name from heroes where id = p_id;
  if v_name is null then raise exception 'hero not found'; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY';
  perform net.http_post(
    url := v_url || '/functions/v1/get-comicvine-hero',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body := jsonb_build_object('heroId', p_id, 'heroName', v_name)
  );
  return 'queued';
end $$;
