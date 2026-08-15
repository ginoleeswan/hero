-- The trailer sweep runs hourly, and its name says so.
--
-- `sync-title-videos` ran once a day at 06:40 UTC. That is a coherent cadence
-- for a catalogue and a wrong one for a feed called "Right Now": a trailer
-- dropped at a D23 panel on a Saturday afternoon in Anaheim is Sunday-morning
-- UTC, so the rail would carry it up to 24 hours later, by which point it is not
-- news. On 2026-08-15, with D23 running, `Avengers: Doomsday` had been checked
-- at 06:40 and the rail had nothing, which is exactly the failure this fixes.
--
-- The sweep is cheap enough that daily was never the constraint: the release
-- window plus trending plus active TV is ~190 titles, and /videos is a tiny
-- endpoint. Hourly is ~4.5k TMDB calls a day, well inside their rate limit, and
-- worst-case staleness drops from 24 hours to one.
--
-- What this does NOT fix: TMDB is community-maintained and is itself often
-- hours behind a trailer's actual release. On the day this was written, TMDB had
-- no Ahsoka season-2, VisionQuest or new Doomsday trailer at all, hours after
-- they were out in the world. Sweeping more often cannot find what the source
-- does not yet have. Closing that gap means reading the official YouTube
-- channels directly, which is a separate piece of work.
--
-- Renamed rather than left as `-daily`: pg_cron will not let the job be renamed
-- in place (`permission denied for table job`), so this unschedules and
-- reschedules inside one transaction. The bearer token is the project's public
-- anon key, carried over verbatim from the original job definition.

do $$
declare
  v_cmd text;
begin
  select command into v_cmd from cron.job where jobname in
    ('sync-title-videos-daily', 'sync-title-videos-hourly');

  if v_cmd is null then
    raise notice 'sync-title-videos job not found; nothing to reschedule';
    return;
  end if;

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'sync-title-videos-daily';

  perform cron.schedule('sync-title-videos-hourly', '40 * * * *', v_cmd);
end
$$;
