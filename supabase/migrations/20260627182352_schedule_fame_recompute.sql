-- Weekly automatic fame_score recompute. Pure in-DB call (recompute_fame_scores
-- is a local SECURITY DEFINER function owned by postgres), so no http_post is
-- needed. Keeps scores fresh as upstream signals (wikidata_sitelinks, movie_count,
-- issue_count) get refreshed by the enrich pipelines between monthly re-ratings.
-- The monthly Claude agent handles rating new/risen heroes (judgment); this cron
-- only re-derives scores from current columns + tiers — idempotent and cheap.
-- To PAUSE: select cron.unschedule('recompute-fame-scores');

create extension if not exists pg_cron;

select cron.schedule(
  'recompute-fame-scores',
  '0 4 * * 0',
  $cron$ select public.recompute_fame_scores(); $cron$
);
