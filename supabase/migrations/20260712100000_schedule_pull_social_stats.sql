-- Nightly stats auto-pull (stage 1: reddit public JSON). Runs after midnight
-- UTC; the edge function is idempotent per night (each run adds a snapshot,
-- rollups take the latest). cron.schedule() is idempotent by name.
select cron.schedule(
  'pull-social-stats-nightly',
  '40 4 * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/pull-social-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
