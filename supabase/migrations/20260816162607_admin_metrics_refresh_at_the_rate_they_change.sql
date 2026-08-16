-- refresh_admin_metrics recomputed all four command-center payloads every 20
-- minutes. Measured cost per run:
--
--   compute_catalog_health          3,299 ms   full scan of heroes
--   compute_enrichment_progress     2,788 ms   full scan of heroes
--   compute_get_source_coverage     1,370 ms   full scan of heroes
--   compute_admin_community_overview  195 ms   votes / takes / profiles
--
-- These are honest aggregates — `count(*) filter (...)` over every row — so no
-- index makes them cheaper. The waste is not in the query, it is in the clock.
-- The first three read enrichment state, which changes when the enrichment
-- drains run: every six hours, plus nightly. Recomputing them 72 times a day
-- scanned the 243 MB heroes heap 216 times to observe at most 5 changes, and it
-- did so on a free-tier instance with a burst IO budget that user requests
-- share. Only the fourth tracks anything that moves on its own — votes, takes,
-- new profiles — and it is the one that costs almost nothing.
--
-- So the refresh takes a scope, and the schedules follow the change rates:
-- catalogue at :20 past every sixth hour (twenty minutes after the drains at
-- :00, so it reflects the run that just finished) and community hourly.
-- nightly_maintenance still forces a full refresh so the morning view is exact.
--
-- The cache table and read path are untouched: `admin_metric_cache` still holds
-- one row per key and the command center still reads all four the same way.

create or replace function public.refresh_admin_metrics(p_scope text default 'all')
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_scope not in ('all', 'catalog', 'community') then
    raise exception 'refresh_admin_metrics: unknown scope %', p_scope;
  end if;

  if p_scope in ('all', 'catalog') then
    insert into admin_metric_cache (key, payload, computed_at) values
      ('enrichment_progress', public.compute_enrichment_progress(),            now()),
      ('catalog_health',      public.compute_catalog_health(),                 now()),
      ('source_coverage',     public.compute_get_source_coverage()::jsonb,     now())
    on conflict (key) do update
      set payload = excluded.payload, computed_at = excluded.computed_at;
  end if;

  if p_scope in ('all', 'community') then
    insert into admin_metric_cache (key, payload, computed_at) values
      ('community_overview',  public.compute_admin_community_overview()::jsonb, now())
    on conflict (key) do update
      set payload = excluded.payload, computed_at = excluded.computed_at;
  end if;
end;
$function$;

revoke execute on function public.refresh_admin_metrics(text) from anon, authenticated, public;
grant execute on function public.refresh_admin_metrics(text) to service_role;;
