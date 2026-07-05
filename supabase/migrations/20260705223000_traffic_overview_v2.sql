-- admin_traffic_overview v2: give the command-center Traffic tab enough signal for
-- an admin to know what's going on at a glance. Additive — every field the previous
-- version returned is preserved; new fields:
--   prev       — same-length previous window totals, for growth deltas (▲/▼ %).
--   audience   — distinct signed-in vs anonymous visitors over the window.
--   today/yesterday — today-so-far pulse + a day-over-day compare.
--   topHeroes  — character paths (/character/<id>) resolved to hero names: what's hot.
--   live       — most recent views (hero name resolved) for a live activity feed.
-- page_views is tiny and already indexed on created_at/route/session, so no perf work.
create or replace function public.admin_traffic_overview(p_days integer default 28)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  is_admin boolean := exists (
    select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin
  );
  v_days int := greatest(p_days, 1);
  v_since timestamptz := (current_date - make_interval(days => v_days - 1));
  v_prev_since timestamptz := (current_date - make_interval(days => v_days * 2 - 1));
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'rangeDays', v_days,
    'totals', (select json_build_object(
      'pageViews', count(*),
      'visitors',  count(distinct coalesce(user_id::text, session_id))
    ) from public.page_views where created_at >= v_since),
    -- Previous equal-length window, for period-over-period deltas.
    'prev', (select json_build_object(
      'pageViews', count(*),
      'visitors',  count(distinct coalesce(user_id::text, session_id))
    ) from public.page_views where created_at >= v_prev_since and created_at < v_since),
    -- Signed-in vs anonymous visitors over the window.
    'audience', (select json_build_object(
      'signedIn', count(distinct user_id) filter (where user_id is not null),
      'anon',     count(distinct session_id) filter (where user_id is null)
    ) from public.page_views where created_at >= v_since),
    'today', (select json_build_object(
      'views',    count(*),
      'visitors', count(distinct coalesce(user_id::text, session_id))
    ) from public.page_views where created_at >= current_date),
    'yesterday', (select json_build_object(
      'views', count(*)
    ) from public.page_views where created_at >= current_date - 1 and created_at < current_date),
    -- Live: unique visitors (signed-in or anon) seen in the last 5 minutes.
    'activeNow', (select count(distinct coalesce(user_id::text, session_id))::int
                    from public.page_views where created_at > now() - interval '5 minutes'),
    -- Daily trend, gap-filled across the window so the chart has one point/day.
    'series', (select coalesce(json_agg(r), '[]'::json) from (
      select to_char(d.day, 'YYYY-MM-DD') as day,
             count(pv.id)::int as views,
             count(distinct coalesce(pv.user_id::text, pv.session_id))::int as visitors
      from generate_series(v_since, current_date, interval '1 day') as d(day)
      left join public.page_views pv
        on pv.created_at >= d.day and pv.created_at < d.day + interval '1 day'
      group by d.day
      order by d.day
    ) r),
    'topPages', (select coalesce(json_agg(r), '[]'::json) from (
      select route, count(*)::int as views
      from public.page_views
      where created_at >= v_since
      group by route
      order by count(*) desc
      limit 8
    ) r),
    'topReferrers', (select coalesce(json_agg(r), '[]'::json) from (
      select referrer as source, count(*)::int as views
      from public.page_views
      where created_at >= v_since and referrer is not null and referrer <> ''
      group by referrer
      order by count(*) desc
      limit 8
    ) r),
    'devices', (select coalesce(json_agg(r), '[]'::json) from (
      select coalesce(nullif(device, ''), 'unknown') as label, count(*)::int as views
      from public.page_views
      where created_at >= v_since
      group by coalesce(nullif(device, ''), 'unknown')
      order by count(*) desc
    ) r),
    -- What's hot: character routes resolved to real hero names (+ art).
    'topHeroes', (select coalesce(json_agg(r), '[]'::json) from (
      select h.id, h.name, coalesce(h.portrait_url, h.image_url) as image, pv.cnt::int as views
      from (
        select split_part(path, '/', 3) as hid, count(*) as cnt
        from public.page_views
        where created_at >= v_since and path like '/character/%'
        group by split_part(path, '/', 3)
      ) pv
      join public.heroes h on h.id = pv.hid
      order by pv.cnt desc
      limit 8
    ) r),
    -- Live activity feed: the most recent views, hero name resolved where the path
    -- is a character route.
    'live', (select coalesce(json_agg(r), '[]'::json) from (
      select pv.route,
             pv.path,
             h.name as name,
             pv.created_at as at
      from public.page_views pv
      left join public.heroes h
        on pv.path like '/character/%' and h.id = split_part(pv.path, '/', 3)
      order by pv.created_at desc
      limit 12
    ) r)
  );
end;
$function$;
