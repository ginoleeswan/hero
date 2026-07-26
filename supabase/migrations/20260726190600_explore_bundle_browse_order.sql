-- Browse the Universe is now ordered by draw rather than by axis (widest
-- doorways in the first row; see BROWSE_PODS in
-- src/components/home/CategoryPodGrid.tsx). The baked slug array has to match
-- the client's array exactly INCLUDING ORDER — get_explore_bundle serves the
-- cache only when `slugs = p_browse_slugs`, and array equality is
-- order-sensitive, so a stale order means every visitor silently falls through
-- to the live compute and its 3s anon timeout.
create or replace function public.refresh_explore_bundle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- MIRRORS BROWSE_PODS in src/components/home/CategoryPodGrid.tsx — same
  -- members, same ORDER.
  v_slugs text[] := array['villain','strongest','anime','video-games','horror',
                          'franchise-icons','mythology','aliens','magic','xmen',
                          'anti-heroes','most-intelligent'];
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

select public.refresh_explore_bundle();
