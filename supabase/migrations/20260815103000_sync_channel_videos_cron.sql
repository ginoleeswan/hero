-- Sweep the official channels every hour, offset from the TMDB sweep.
--
-- :10 rather than :40 so the two video pipelines do not contend, and so the
-- channel feeds (the fast source) land first and TMDB fills in behind them with
-- the richer metadata when it eventually catches up.
--
-- Sixteen unauthenticated RSS fetches an hour is nothing, and there is no key or
-- quota to exhaust. The body carries no limit so the function's own default (50
-- channels) applies, which covers the seed list with room to grow.

do $$
declare
  v_key text;
begin
  -- Reuse the anon bearer the other jobs already carry rather than pasting a
  -- second copy of it: one place to change if it ever rotates.
  select substring(command from 'Bearer ([A-Za-z0-9._-]+)')
  into v_key
  from cron.job
  where jobname = 'sync-title-videos-hourly';

  if v_key is null then
    raise exception 'could not read the anon key from an existing cron job';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'sync-channel-videos-hourly';

  perform cron.schedule(
    'sync-channel-videos-hourly',
    '10 * * * *',
    format($cmd$
      select net.http_post(
        url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-channel-videos',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := jsonb_build_object('triggeredBy', 'cron'),
        timeout_milliseconds := 120000
      );
    $cmd$, v_key)
  );
end
$$;
