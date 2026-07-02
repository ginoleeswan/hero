-- Cache layer for get_explore_bundle. The anonymous Explore payload is
-- identical for every visitor, but computing it live costs 0.3s warm / ~4.5s
-- cold — and the anon role's statement_timeout is 3s, so cold-cache visitors
-- intermittently got 500s (the same class of failure as the old ~15-request
-- fan-out). Serve a precomputed single-row cache instead (~5ms, timeout-proof);
-- pg_cron refreshes it every 10 minutes, which also keeps the working set warm.
--
--  * compute_explore_bundle  — the real work (was get_explore_bundle's body);
--                              not executable by anon (would trip its timeout).
--  * explore_bundle_cache    — single row, RLS-locked; only the security-definer
--                              functions below touch it.
--  * refresh_explore_bundle  — recompute + upsert. The baked-in slug list
--                              MIRRORS BROWSE_PODS (src/components/home/
--                              CategoryPodGrid.tsx) — keep both in sync.
--  * get_explore_bundle      — public API, unchanged signature: serves the
--                              cache when args match, computes live otherwise.

alter function public.get_explore_bundle(text[], int)
  rename to compute_explore_bundle;

revoke execute on function public.compute_explore_bundle(text[], int)
  from public, anon, authenticated;

create table public.explore_bundle_cache (
  id int primary key check (id = 1),
  slugs text[] not null,
  per_slug int not null,
  payload jsonb not null,
  refreshed_at timestamptz not null default now()
);

-- RLS on, deliberately no policies: reads go through the security-definer
-- get_explore_bundle below, never straight from a client.
alter table public.explore_bundle_cache enable row level security;

create or replace function public.refresh_explore_bundle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- MIRRORS BROWSE_PODS in src/components/home/CategoryPodGrid.tsx.
  v_slugs text[] := array['marvel','dc','image','villain','xmen','anti-heroes',
                          'franchise-icons','anime','video-games','horror',
                          'strongest','most-intelligent'];
begin
  insert into explore_bundle_cache (id, slugs, per_slug, payload, refreshed_at)
  values (1, v_slugs, 40, compute_explore_bundle(v_slugs, 40), now())
  on conflict (id) do update
    set slugs = excluded.slugs,
        per_slug = excluded.per_slug,
        payload = excluded.payload,
        refreshed_at = excluded.refreshed_at;
end;
$$;

revoke execute on function public.refresh_explore_bundle()
  from public, anon, authenticated;

create or replace function public.get_explore_bundle(
  p_browse_slugs text[],
  p_browse_per_slug int default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select payload into v_payload
  from explore_bundle_cache
  where id = 1
    and slugs = p_browse_slugs
    and per_slug = p_browse_per_slug;
  if v_payload is not null then
    return v_payload;
  end if;
  -- Cache miss (never refreshed yet, or the client's pods changed before the
  -- mirrored list here caught up): compute live. Runs as the function owner, so
  -- the caller's 3s anon timeout still applies to the whole statement — this
  -- path is a correctness fallback, not the fast path.
  return compute_explore_bundle(p_browse_slugs, p_browse_per_slug);
end;
$$;

grant execute on function public.get_explore_bundle(text[], int) to anon, authenticated;

-- Refresh every 10 minutes (named job — re-scheduling replaces, not duplicates).
select cron.schedule(
  'refresh-explore-bundle',
  '*/10 * * * *',
  'select public.refresh_explore_bundle();'
);

-- Seed the cache now so the first visitor never hits the live-compute path.
select public.refresh_explore_bundle();
