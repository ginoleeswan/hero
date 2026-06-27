-- Pause the fuzzy Wikidata resolve cron. The deterministic P5905 (ComicVine-id ->
-- QID) sweep is exhausted (4,729 resolved; a full sweep of the remaining ~29k
-- found only 14 matchable), so the every-3-min cron now only re-scans unmatchable
-- heroes via fuzzy name-matching — wasted WDQS calls plus the risk of Bane->
-- Wolfsbane mis-resolutions that would inject wrong fame signals. Re-run a
-- deterministic sweep on demand after future bulk ingestion instead.
-- To RESUME: re-create via schedule_pipeline_crons' cron.schedule block.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'resolve-wikidata-pending') then
    perform cron.unschedule('resolve-wikidata-pending');
  end if;
end $$;
