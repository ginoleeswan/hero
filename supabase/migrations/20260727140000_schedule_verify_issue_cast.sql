-- Schedule verify-issue-cast. Without this the cast fix decays.
--
-- The verifier replaces volume-guessed issue casts with ComicVine's per-issue
-- character_credits, and strips anthology fabrications. It shipped without a
-- schedule and was only ever run by hand, which leaves two holes:
--
--   * comics ship ~24 a week and sync-new-comics writes each one a roster guess,
--     so the unverified pile refills every Wednesday. Measured 2026-07-27: 61 of
--     177 recent issues were still on unverified 'volume' casts, 36 never checked.
--   * ComicVine's credits are crowdsourced and LAG new releases by days. Half the
--     issues sampled had none on release day. A single pass can't fix that; only
--     re-checking can, which is the whole reason cast_verified_at is a cursor
--     rather than a boolean.
--
-- Daily at 05:10 UTC: clear of the 03:40 nightly crunch, before sync-title-videos
-- at 06:40, and late enough that the hourly sync-new-comics has already brought
-- in the night's issues. 40 issues per run at ComicVine's 1.5s courtesy spacing
-- is about a minute of wall clock.
--
-- To PAUSE: select cron.unschedule('verify-issue-cast-daily');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'verify-issue-cast-daily',
  '10 5 * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/verify-issue-cast',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('triggeredBy', 'cron', 'limit', 40, 'days', 30),
    timeout_milliseconds := 180000
  );
  $cron$
);
