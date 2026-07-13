-- Cut background disk-IO consumption by slowing the high-frequency pipeline crons.
--
-- Why: on the free-tier (Nano) instance, disk IO runs on a burst budget (43 Mbps
-- baseline, ~30 min/day of burst). A fleet of enrichment/refresh crons firing
-- every 1–10 min, 24/7, was draining that budget with zero user traffic — once
-- the burst budget is spent the instance drops to baseline IO and user requests
-- start timing out (504s). These are backfill/refresh jobs for an already-built
-- catalog, so they don't need minute-level cadence.
--
-- What: only the *schedule* is changed (cron.alter_job leaves each job's command
-- and active/paused state untouched). Jobs that are already unscheduled — e.g.
-- resolve-wikidata-pending — are simply skipped. Everything stays listed and
-- Start/Stop-able from the command center's Scheduled crons section.
--
-- Reversible: re-run cron.alter_job with the old schedule, or Start/restore from
-- the dashboard. Old cadences are noted per row below.
--
-- Fully draining a pipeline? Stop it in the dashboard (or cron.unschedule the
-- job) instead of leaving it on a slow cadence — a stopped job costs nothing.

do $$
declare
  job   record;
  target record;
begin
  for target in
    select * from (values
      -- jobname                       new schedule    (old cadence → new)
      ('refresh-explore-bundle',       '0 * * * *'),   -- */10 → hourly  (fame recomputes weekly; the heaviest cron — a full in-DB aggregate each run)
      ('enrich-comicvine-pending',     '0 */6 * * *'), -- */3  → every 6h (ComicVine backfill; no-op once drained)
      ('enrich-tmdb-pending',          '0 */6 * * *'), -- */2  → every 6h (TMDB backfill; no-op once drained)
      ('enrich-wikidata-pending',      '0 */6 * * *'), -- */3  → every 6h (Wikidata appearances backfill)
      ('resolve-enwiki-title-drain',   '0 */6 * * *'), -- */5  → every 6h (one-time enwiki title backfill; no-op once complete)
      ('sync-wiki-pageviews-cycle',    '0 */2 * * *')  -- */10 → every 2h (pageview-trending cycle; slower rotation, far less IO)
    ) as t(jobname, schedule)
  loop
    for job in select jobid from cron.job where jobname = target.jobname loop
      perform cron.alter_job(job.jobid, schedule := target.schedule);
      raise notice 'rescheduled % -> %', target.jobname, target.schedule;
    end loop;
  end loop;
end $$;
