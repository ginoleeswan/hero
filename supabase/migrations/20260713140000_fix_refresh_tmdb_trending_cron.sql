-- Fix the weekly refresh-tmdb-trending cron (jobid 18), which failed every run.
--
-- Symptom: `ERROR: canceling statement due to statement timeout` after a full
-- ~2m05s — despite the target window (film/tv, release_date in [-540,+120] days)
-- matching only ~20 rows. Twenty row-updates can't take 2 minutes of work, so the
-- statement was BLOCKED on a lock the whole time (statement_timeout cancels a
-- blocked statement at 120s). It fired at 04:17, inside the congested 03:40-04:40
-- nightly cron crunch on the connection/disk-IO-starved free tier
-- (see the Supabase IO-ceiling notes). It also re-flipped already-fresh titles to
-- 'pending' every week, pointlessly re-driving the enrich-tmdb-pending drain.
--
-- Fix, three parts:
--   1. Bound the UPDATE to genuinely-stale `done` rows (enriched_at older than
--      14 days) — idempotent, minimal write set, no more thundering-herd re-drain.
--   2. Wrap in a DO block with SET LOCAL lock_timeout so it can never hang for two
--      minutes; a lock it can't grab quickly becomes a graceful skip, not a hard
--      failure (this is a best-effort freshness sweep).
--   3. Move off the crunch to a quiet hour — 09:30 Mon (no other cron fires then).
--
-- Reversible: cron.schedule() upserts by name; the prior body was a bare
-- `update ... set enrich_status='pending' where media_type in ('film','tv')
--  and release_date between current_date-540 and current_date+120;` at '17 4 * * 1'.
select cron.schedule(
  'refresh-tmdb-trending',
  '30 9 * * 1',
  $cron$
  do $body$
  begin
    set local lock_timeout = '10s';
    update public.titles
    set enrich_status = 'pending'
    where media_type in ('film', 'tv')
      and release_date between current_date - 540 and current_date + 120
      and enrich_status = 'done'
      and (enriched_at is null or enriched_at < now() - interval '14 days');
  exception when lock_not_available then
    raise notice 'refresh-tmdb-trending: skipped run, could not acquire lock in time';
  end
  $body$;
  $cron$
);
