-- Consolidate the daily catalog-health snapshot into nightly_maintenance()
-- instead of its own cron (one fewer job). It now runs AFTER the relationship
-- rebuild + cast-link, so the snapshot reflects the post-maintenance state.
-- Pure SQL, no external API.
create or replace function public.nightly_maintenance()
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  perform public.rebuild_hero_relationships();
  perform public.link_tmdb_cast();
  perform public.snapshot_catalog_health();
end $$;

select cron.unschedule('catalog-health-snapshot');
