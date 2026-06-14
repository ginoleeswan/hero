-- Unattended TMDB drain. Mirrors the ComicVine schedule: pg_cron fires an async
-- net.http_post into enrich-tmdb-batch. Matches pending queue rows + enriches
-- pending films each run; a no-op once both backlogs hit zero. New films from
-- future ingestion (queue re-populate) are picked up automatically.
-- To PAUSE: select cron.unschedule('enrich-tmdb-pending');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'enrich-tmdb-pending',
  '*/2 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/enrich-tmdb-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('limit', 25),
    timeout_milliseconds := 120000
  );
  $cron$
);
