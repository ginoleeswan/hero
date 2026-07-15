-- Daily-debate push. Fires at 15:00 UTC (morning US / evening EU), well after
-- the daily-debate-roll cron (00:05 UTC) so today's daily_debate row is
-- guaranteed present. The function is inert until VAPID secrets are set, so this
-- can schedule ahead of setup. cron.schedule() is idempotent by name.
select cron.schedule(
  'send-daily-push',
  '0 15 * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/send-daily-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
