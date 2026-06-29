-- Schedule a daily rebuild of hero_relationships.
--
-- Why: heroes enriched by the ComicVine drain (enrich-comicvine-batch, cron
-- job 10) get their enemies/friends/teams *name arrays* written, but the
-- resolved ally/enemy/teammate *cards* live in hero_relationships, which is only
-- (re)built by rebuild_hero_relationships(). That function had no schedule, so
-- newly-enriched heroes showed empty allies/enemies/teammates until a manual
-- rebuild (the "Hawkeye had no relationships" bug, systemic across the backlog).
--
-- Cadence: the rebuild is pure SQL (no external API) but does a full
-- TRUNCATE + re-insert (~50s, ~389k rows) under an ACCESS EXCLUSIVE lock on
-- hero_relationships. So it runs ONCE daily at a low-traffic hour rather than
-- frequently — newly-enriched heroes self-heal within a day; marquee fixes get
-- an on-demand rebuild. cron.schedule() is idempotent by name.
select cron.schedule(
  'rebuild-relationships-daily',
  '40 3 * * *',
  $$select public.rebuild_hero_relationships();$$
);
