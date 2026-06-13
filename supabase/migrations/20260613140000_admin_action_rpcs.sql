-- Admin-guarded action RPCs powering the catalog-health console.
create or replace function admin_run_drain(p_limit int default 25)
returns text language plpgsql security definer as $$
declare v_url text; v_key text;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY';
  perform net.http_post(
    url := v_url || '/functions/v1/enrich-comicvine-batch',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body := jsonb_build_object('limit', greatest(1, least(p_limit, 50)), 'triggeredBy', 'admin')
  );
  return 'queued';
end $$;

create or replace function admin_retry_failed()
returns int language plpgsql security definer as $$
declare n int;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update heroes set comicvine_status = 'pending'
   where comicvine_status = 'failed' and comicvine_id is not null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function admin_set_drain_cron(p_enabled boolean)
returns text language plpgsql security definer as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if exists (select 1 from cron.job where jobname = 'enrich-comicvine-pending') then
    perform cron.unschedule('enrich-comicvine-pending');
  end if;
  if p_enabled then
    perform cron.schedule('enrich-comicvine-pending', '*/3 * * * *',
      $cmd$select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/enrich-comicvine-batch',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')),
        body := '{}'::jsonb
      );$cmd$);
    return 'enabled';
  end if;
  return 'disabled';
end $$;
