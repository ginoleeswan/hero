-- Unschedule the fully-drained blurhash enrichment cron.
--
-- Why: enrich-blurhash-pending (jobid 44) was the single largest background
-- disk-IO consumer — 720 runs/24h (every 2 min), ~71 min/day of execution,
-- 109/720 runs failing — yet the backlog it drains is empty:
--   select count(*) from heroes
--   where portrait_url is not null and portrait_blurhash is null;  -- => 0
-- Every run wakes the edge function, which scans heroes for pending portraits,
-- finds none, and returns. On the free-tier (Nano) IO burst budget that idle
-- scan loop is pure waste and was a prime contributor to the disk-IO
-- starvation that times out user requests (504s) and freezes the web boot.
--
-- What: a stopped job costs nothing, so we unschedule rather than slow it (the
-- calm_pipeline_crons migration only slowed jobs that still have real backlog).
-- The enrich-blurhash-batch edge function is untouched — when the catalog grows
-- and new portraits need hashing, reschedule with:
--   select cron.schedule('enrich-blurhash-pending', '*/2 * * * *', $cmd$…$cmd$);
-- or Start it from the command center's Scheduled crons section.
--
-- Reversible: cron.schedule(...) with the original command (preserved in the
-- dashboard / git history of the job's http_post body).

select cron.unschedule('enrich-blurhash-pending')
where exists (select 1 from cron.job where jobname = 'enrich-blurhash-pending');
