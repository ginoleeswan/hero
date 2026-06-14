-- Stand up the remaining self-draining pipeline crons so the whole enrichment
-- funnel can advance unattended, fully controllable from the command center's
-- Scheduled crons section (admin_cron_status lists every cron.job row; Start/Stop
-- flips active via admin_toggle_cron).
--
-- Each fires net.http_post into its stage's batch edge function with the
-- service-role bearer pulled from vault (same pattern as admin_run_wikidata_*).
-- Every stage gates on the previous stage's status columns, so running them
-- concurrently just cascades safely; a clear backlog is a cheap no-op, and any
-- newly-added hero is picked up automatically.
--
-- Created PAUSED (active=false) — nothing drains until you press Start in the
-- dashboard. Pre-existing crons unaffected: catalog-health-snapshot (active),
-- enrich-tmdb-pending (paused). Gemini-cost work (powerstats, portraits) is
-- intentionally NOT cronned — it runs on demand, gated on the monthly budget.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1 · ComicVine drain — core hero data (powers, bio, image, first issue, movies).
--     The gate: every downstream stage needs comicvine_status='done' first.
select cron.schedule(
  'enrich-comicvine-pending',
  '*/2 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/enrich-comicvine-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := jsonb_build_object('limit', 10, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);

-- 2 · Wikidata resolve — match each ComicVine-done hero to its single QID identity.
select cron.schedule(
  'resolve-wikidata-pending',
  '*/3 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/resolve-wikidata-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := jsonb_build_object('limit', 15, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);

-- 3 · Wikidata appearances — cross-media appearances + cast for resolved heroes.
select cron.schedule(
  'enrich-wikidata-pending',
  '*/3 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/enrich-wikidata-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := jsonb_build_object('limit', 15, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);

-- Create them paused — start each from the dashboard when ready.
do $$
declare r record;
begin
  for r in
    select jobid from cron.job
    where jobname in ('enrich-comicvine-pending', 'resolve-wikidata-pending', 'enrich-wikidata-pending')
  loop
    perform cron.alter_job(r.jobid, active := false);
  end loop;
end $$;
