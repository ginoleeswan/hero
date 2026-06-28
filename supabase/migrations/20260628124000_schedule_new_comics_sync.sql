-- Unattended weekly-comics sync. Mirrors schedule_tmdb_drain: pg_cron fires an
-- async net.http_post into sync-new-comics. Hourly with maxVolumes=10 chews
-- through the one-time volume-roster backlog in ~a day, then no-ops once every
-- volume in the window is cached. To PAUSE: select cron.unschedule('sync-new-comics-hourly');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-new-comics-hourly',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-new-comics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('days', 14, 'maxVolumes', 10, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
