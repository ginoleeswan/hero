-- Tune the ComicVine drain cadence down under ComicVine's rate ceiling.
--
-- The initial every-minute × limit-12 schedule (~720 character-calls/hr) blew past
-- ComicVine's ~200 requests/hour-per-resource limit and got the API key throttled:
-- runs started returning done:0 / retry:12 (every hero 420'd, left pending to retry
-- by the transient-handling logic — no data lost, but zero forward progress).
--
-- New cadence: every 3 min × limit 8 ≈ 160 heroes/hr — under the 200/hr ceiling so
-- ComicVine stops throttling and the backlog actually drains (~16-17h from here).
-- Re-running cron.schedule with the same job name replaces the existing schedule.

select cron.schedule(
  'enrich-comicvine-pending',
  '*/3 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/enrich-comicvine-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('limit', 8),
    timeout_milliseconds := 120000
  );
  $cron$
);
