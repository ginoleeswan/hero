-- Two jobs: drain the one-time enwiki-title backfill every 5 min (a cheap no-op
-- once complete), and refresh pageviews every 10 min so all heroes cycle daily.
-- To PAUSE: select cron.unschedule('resolve-enwiki-title-drain'); / ('sync-wiki-pageviews-cycle');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'resolve-enwiki-title-drain',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/resolve-enwiki-title',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('limit', 300, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);

select cron.schedule(
  'sync-wiki-pageviews-cycle',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-wiki-pageviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('limit', 60, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
