-- Admin-triggered Wikidata enrich drain, mirroring admin_run_wikidata_resolve.
create or replace function public.admin_run_wikidata_enrich(p_limit integer default 10)
returns text
language plpgsql
security definer
as $function$
declare v_url text; v_key text;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY';
  perform net.http_post(
    url := v_url || '/functions/v1/enrich-wikidata-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('limit', greatest(1, least(p_limit, 25)), 'triggeredBy', 'admin')
  );
  return 'queued';
end $function$;
