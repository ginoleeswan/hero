-- Daily TMDB trending refresh at 08:00 UTC. Mirrors schedule_tmdb_drain.
-- To PAUSE: select cron.unschedule('sync-tmdb-trending-daily');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-tmdb-trending-daily',
  '0 8 * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-tmdb-trending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('pages', 2, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
