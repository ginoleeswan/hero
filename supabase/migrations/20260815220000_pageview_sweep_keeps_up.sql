-- The pageview sweep runs often enough to actually cover the catalogue.
--
-- `heroes.views_daily` is the input to the entire surge lane: it is what dates a
-- surge, what `pageviews_spike` is computed from, and the only measurement
-- Mythique has of what an AUDIENCE did rather than what a studio announced. It is
-- the one genuinely differentiated signal in the product.
--
-- It was being refreshed at 60 heroes every two hours — 720 a day, against 4,876
-- heroes that have an enwiki_title. That is a 6.8-day refresh cycle, and it is
-- slower than resolve-enwiki-title-drain adds new titles to the queue, so the
-- backlog grows rather than clears: 1,019 heroes had an article and had NEVER had
-- their pageviews fetched, despite the sweep ordering nulls first.
--
-- The consequence is measurable and was measured on 2026-08-15. During D23 —
-- with VisionQuest, Ahsoka season 2 and an X-Men cast reveal all announced — not
-- one of Vision, Ultron, Ahsoka Tano, Wolverine, Cyclops, Storm or Magneto was
-- above 1.5x, and every one of their curves ended between 8 and 13 August. Some
-- of that is the Wikimedia API's own 1-2 day lag, which nothing can fix. The rest
-- was simply that we had not looked.
--
-- 120 every 30 minutes is 5,760 a day: every hero with an article, refreshed
-- daily, with headroom for the catalogue to keep growing. The function already
-- caps `limit` at 120 and paces its requests, and these are unauthenticated
-- Wikimedia REST calls with no quota to exhaust — the constraint was courtesy,
-- and one request every few hundred milliseconds remains courteous.
--
-- Note for anyone reading docs/architecture/data-pipelines.md: it described this
-- job as running every 10 minutes. It was running every two hours.

do $$
declare v_cmd text;
begin
  select command into v_cmd from cron.job where jobname = 'sync-wiki-pageviews-cycle';
  if v_cmd is null then
    raise exception 'sync-wiki-pageviews-cycle not found';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'sync-wiki-pageviews-cycle';
  perform cron.schedule(
    'sync-wiki-pageviews-cycle',
    '*/30 * * * *',
    replace(v_cmd, '''limit'', 60', '''limit'', 120')
  );
end
$$;
