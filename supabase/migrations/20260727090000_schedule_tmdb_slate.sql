-- Schedule sync-tmdb-slate — keep an upcoming slate in the catalogue at all.
--
-- Measured 2026-07-27, before this ran: of 2,507 TMDB titles exactly ONE had a
-- future release date, and the newest Avengers film in the table was Endgame
-- (2019). Avengers: Doomsday had no row on the weekend SDCC made it the biggest
-- story in the fandom and drove Doctor Doom to 197,899 pageviews. The Pulse
-- rail's trailer lane was not thin because trailers are rare — it was thin
-- because the films they belong to did not exist here.
--
-- The first manual run inserted 151 titles and took future_titles from 1 to 59.
--
-- Weekly, not daily: a release slate moves on the order of weeks, and /discover
-- is the one call in this pipeline that scans rather than looks up. Monday 05:40
-- UTC sits after the 03:40 nightly crunch (whose nightly_maintenance() call runs
-- link_tmdb_cast, the step that makes a new title eligible to surface) and an
-- hour before sync-title-videos at 06:40, so a fresh row is enriched, linked and
-- swept for trailers inside the same morning.
--
-- The rest of the chain already exists and needs no changes:
--   sync-tmdb-slate (here)   inserts thin rows at enrich_status='pending'
--   enrich-tmdb-pending      0 */6 * * *  fills details + videos
--   nightly-maintenance      40 3 * * *   link_tmdb_cast -> hero_media_appearances
--   sync-title-videos-daily  40 6 * * *   re-sweeps /videos for the release window
--   get_pulse_candidates                  surfaces the trailer as an event
--
-- To PAUSE: select cron.unschedule('sync-tmdb-slate-weekly');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-tmdb-slate-weekly',
  '40 5 * * 1',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-tmdb-slate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('triggeredBy', 'cron', 'maxPages', 10),
    timeout_milliseconds := 180000
  );
  $cron$
);
