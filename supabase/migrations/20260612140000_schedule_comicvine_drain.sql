-- Phase 3: stand up the ComicVine enrichment as an unattended, self-draining
-- background job so nobody has to hand-run the batch enricher.
--
-- Mechanism (all server-side on Supabase):
--   pg_cron  — runs a SQL line on a schedule, on the database itself.
--   pg_net   — lets that SQL fire an async HTTP POST (net.http_post).
-- Together they call the `enrich-comicvine-batch` edge function every 2 minutes,
-- which enriches the next slice of `comicvine_status='pending'` heroes (popularity
-- order) and writes them back. Transient ComicVine throttles leave rows `pending`
-- (the fn returns them as `retry`), so the job self-heals; genuine no-matches are
-- parked as `failed`. When the backlog reaches 0 the job is a cheap no-op, and any
-- future hero added by ingestion (status defaults to `pending`) is picked up
-- automatically — so this becomes the permanent enrichment pipeline.
--
-- Cadence: every 1 min × limit 12 ≈ 720 heroes/hr (full drain in ~4 hrs). Higher
-- chance of transient ComicVine throttles, which simply leave rows `pending` to
-- retry next minute. Tune by re-running cron.schedule with the same name.
--
-- To PAUSE/REMOVE:  select cron.unschedule('enrich-comicvine-pending');
-- The Authorization bearer is the project's public anon key (already shipped in
-- the app bundle); the edge fn keeps verify_jwt on and a valid JWT satisfies it.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'enrich-comicvine-pending',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/enrich-comicvine-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('limit', 12),
    timeout_milliseconds := 120000
  );
  $cron$
);
