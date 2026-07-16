-- admin_traffic_overview v4 — additive: every field v3 returned is preserved;
-- the `acquisition` rows gain `engaged` (sessions with ≥2 page views in the
-- window). Rationale: signup is the wrong yardstick for a browse-first app —
-- most paid visitors will never create an account even when the visit lands.
-- "Engaged" (they stayed and looked at more than the landing view) is the
-- activation signal that tells scale-vs-fix apart per campaign.
-- `signups` semantics tighten slightly to "sessions signed in at any point",
-- via the same lateral scan (previously distinct user_ids; equivalent at this
-- scale, one scan instead of two).
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
    ) r),
    -- Acquisition: first-touch sessions in the window, bucketed by campaign
    -- (falling back to source, then referrer, then 'direct').
    --   visitors — distinct first-touch sessions
    --   engaged  — of those, sessions with ≥2 page views (they stayed)
    --   signups  — of those, sessions signed in on any view
    'acquisition', (select coalesce(json_agg(r), '[]'::json) from (
      select
        coalesce(nullif(sa.utm_campaign, ''), nullif(sa.utm_source, ''),
                 nullif(sa.referrer, ''), 'direct') as label,
        sa.utm_source   as source,
        sa.utm_campaign as campaign,
        count(distinct sa.session_id)::int                                as visitors,
        count(distinct sa.session_id) filter (where s.views >= 2)::int    as engaged,
        count(distinct sa.session_id) filter (where s.signed_in)::int     as signups
      from public.session_attribution sa
      left join lateral (
        select count(*)::int as views,
               bool_or(pv.user_id is not null) as signed_in
        from public.page_views pv
        where pv.session_id = sa.session_id and pv.created_at >= v_since
      ) s on true
      where sa.first_seen >= v_since
      group by 1, 2, 3
      order by count(distinct sa.session_id) desc
      limit 10
    ) r)
  );
end;
$function$;

revoke all on function public.admin_traffic_overview(int) from public, anon;
grant execute on function public.admin_traffic_overview(int) to authenticated, service_role;
