-- Consolidate nightly SQL maintenance behind ONE cron instead of growing the
-- cron count. nightly_maintenance() runs the two pure-SQL housekeeping tasks:
--   1. rebuild_hero_relationships() — resolve enemies/friends/teams name arrays
--      into ally/enemy/teammate cards (so ComicVine-enriched heroes self-heal).
--   2. link_tmdb_cast() — write TMDB cast credits into hero_media_appearances
--      (so the hero-side "On Screen" populates from credits, not just Wikidata).
-- Both are free (no external API). Replaces the rebuild-only daily job.
create or replace function public.nightly_maintenance()
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  perform public.rebuild_hero_relationships();
  perform public.link_tmdb_cast();
end $$;

-- Repoint the daily maintenance cron (was 'rebuild-relationships-daily').
select cron.unschedule('rebuild-relationships-daily');
select cron.schedule(
  'nightly-maintenance',
  '40 3 * * *',
  $$select public.nightly_maintenance();$$
);
