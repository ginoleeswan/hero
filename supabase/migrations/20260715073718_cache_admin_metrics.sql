-- Fix the command center's slow Overview (again). The July 14 covering index
-- made enrichment_progress() an index-only scan, but the catalog has since
-- grown to ~50k heroes and the enrichment drains churn the heap constantly:
-- even fully warm the scan now costs ~900ms of CPU, and cold paths hit 8s —
-- paid on EVERY dashboard visit (mean 3.5s over the last stats window).
-- On-demand full-table aggregates can't win against a growing, churning table.
--
-- Architectural fix: precompute the counts on a 5-minute cron into a one-row
-- cache; the RPC serves the cached payload (sub-ms, verified 1.1ms) and only
-- computes live as a fallback if the cache is missing/stale (cron down).
-- Dashboard counts don't need real-time precision.

create table if not exists public.admin_metric_cache (
  key text primary key,
  payload jsonb not null,
  computed_at timestamptz not null default now()
);
-- No policies: only definer functions touch it.
alter table public.admin_metric_cache enable row level security;

-- The live computation, factored out so the cron and the stale-fallback share it.
create or replace function public.compute_enrichment_progress()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  with h as (
    select
      count(*)                                                                             as total,
      count(*) filter (where comicvine_status = 'done')                                    as cv_done,
      count(*) filter (where comicvine_status = 'unmatched')                               as cv_unmatched,
      count(*) filter (where wikidata_status = 'resolved')                                 as resolved,
      count(*) filter (where wikidata_status = 'ambiguous')                                as ambiguous,
      count(*) filter (where wikidata_status = 'unresolved')                               as unresolved,
      count(*) filter (where wikidata_status = 'resolved' and wikidata_enriched_at is not null) as enriched
    from heroes
  ),
  t as (
    select
      count(*) filter (where media_type = 'film')                        as film,
      count(*) filter (where media_type = 'tv')                          as tv,
      count(*) filter (where media_type = 'game')                        as game,
      count(*) filter (where source = 'tmdb' and enrich_status = 'done') as media_done
    from titles
  )
  select jsonb_build_object(
    'heroesTotal',        h.total,
    'comicvineDone',      h.cv_done,
    'comicvineUnmatched', h.cv_unmatched,
    'resolved',           h.resolved,
    'ambiguous',          h.ambiguous,
    'unresolved',         h.unresolved,
    'enriched',           h.enriched,
    'filmTitles',         t.film,
    'tvTitles',           t.tv,
    'gameTitles',         t.game,
    'mediaDone',          t.media_done
  )
  from h, t;
$$;

create or replace function public.refresh_admin_metrics()
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into admin_metric_cache (key, payload, computed_at)
  values ('enrichment_progress', public.compute_enrichment_progress(), now())
  on conflict (key) do update
    set payload = excluded.payload, computed_at = excluded.computed_at;
$$;
revoke execute on function public.refresh_admin_metrics() from public, anon, authenticated;

-- Same name + signature + output shape as before: the client doesn't change.
create or replace function public.enrichment_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  cached record;
begin
  select payload, computed_at into cached
  from admin_metric_cache
  where key = 'enrichment_progress';
  if found and cached.computed_at > now() - interval '15 minutes' then
    return cached.payload;
  end if;
  -- Cron down or first run: compute live (the old behaviour) rather than 404.
  return public.compute_enrichment_progress();
end;
$$;

-- Refresh every 5 minutes (also keeps the counts index warm as a side effect).
select cron.schedule(
  'refresh-admin-metrics',
  '*/5 * * * *',
  $$select public.refresh_admin_metrics()$$
);

-- Seed the cache immediately so the next dashboard load is already fast.
select public.refresh_admin_metrics();
