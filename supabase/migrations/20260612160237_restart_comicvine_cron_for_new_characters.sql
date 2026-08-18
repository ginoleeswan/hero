
select cron.schedule(
  'enrich-comicvine-pending',
  '*/3 * * * *',
  $$
  select net.http_post(
    url    := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/enrich-comicvine-batch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body   := '{}'::jsonb
  );
  $$
);
;
