-- Command center: exclude bot page views everywhere, not just Visitors.
--
-- 20261021203000 dropped is_bot rows from the two audience RPCs. Traffic
-- (headline totals, today / yesterday, active-now, daily series, top pages /
-- referrers / devices / heroes, the live list, acquisition) and the activity
-- feed still counted them, so the Overview and Traffic read ~8x the real
-- audience and disagreed with Visitors. Same rule here: skip rows
-- classify_bot_traffic() flagged. Acquisition also drops sessions with no
-- human views in the window (a crawler's attribution row). The traffic
-- overview reports what it left out as bots.{views, sessions}.
--
-- Rows stay in page_views. Crawlers that only the hourly IP pass catches
-- count for up to an hour before they're flagged.

CREATE OR REPLACE FUNCTION public.admin_traffic_overview(p_days integer DEFAULT 28)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- What every figure below leaves out (rows classify_bot_traffic() flagged).
    'bots', (select json_build_object(
      'views',    count(*),
      'sessions', count(distinct session_id)
    ) from public.page_views where is_bot and created_at >= v_since),
    'totals', (select json_build_object(
      'pageViews', count(*),
      'visitors',  count(distinct coalesce(user_id::text, session_id))
    ) from public.page_views where not is_bot and created_at >= v_since),
    -- Previous equal-length window, for period-over-period deltas.
    'prev', (select json_build_object(
      'pageViews', count(*),
      'visitors',  count(distinct coalesce(user_id::text, session_id))
    ) from public.page_views where not is_bot and created_at >= v_prev_since and created_at < v_since),
    -- Signed-in vs anonymous visitors over the window.
    'audience', (select json_build_object(
      'signedIn', count(distinct user_id) filter (where user_id is not null),
      'anon',     count(distinct session_id) filter (where user_id is null)
    ) from public.page_views where not is_bot and created_at >= v_since),
    'today', (select json_build_object(
      'views',    count(*),
      'visitors', count(distinct coalesce(user_id::text, session_id))
    ) from public.page_views where not is_bot and created_at >= current_date),
    'yesterday', (select json_build_object(
      'views', count(*)
    ) from public.page_views where not is_bot and created_at >= current_date - 1 and created_at < current_date),
    -- Live: unique visitors (signed-in or anon) seen in the last 5 minutes.
    'activeNow', (select count(distinct coalesce(user_id::text, session_id))::int
                    from public.page_views where not is_bot and created_at > now() - interval '5 minutes'),
    -- Daily trend, gap-filled across the window so the chart has one point/day.
    'series', (select coalesce(json_agg(r), '[]'::json) from (
      select to_char(d.day, 'YYYY-MM-DD') as day,
             count(pv.id)::int as views,
             count(distinct coalesce(pv.user_id::text, pv.session_id))::int as visitors
      from generate_series(v_since, current_date, interval '1 day') as d(day)
      left join public.page_views pv
        on pv.created_at >= d.day and pv.created_at < d.day + interval '1 day'
       and not pv.is_bot
      group by d.day
      order by d.day
    ) r),
    'topPages', (select coalesce(json_agg(r), '[]'::json) from (
      select route, count(*)::int as views
      from public.page_views
      where not is_bot and created_at >= v_since
      group by route
      order by count(*) desc
      limit 8
    ) r),
    'topReferrers', (select coalesce(json_agg(r), '[]'::json) from (
      select referrer as source, count(*)::int as views
      from public.page_views
      where not is_bot and created_at >= v_since and referrer is not null and referrer <> ''
      group by referrer
      order by count(*) desc
      limit 8
    ) r),
    'devices', (select coalesce(json_agg(r), '[]'::json) from (
      select coalesce(nullif(device, ''), 'unknown') as label, count(*)::int as views
      from public.page_views
      where not is_bot and created_at >= v_since
      group by coalesce(nullif(device, ''), 'unknown')
      order by count(*) desc
    ) r),
    -- What's hot: character routes resolved to real hero names (+ art).
    'topHeroes', (select coalesce(json_agg(r), '[]'::json) from (
      select h.id, h.name, coalesce(h.portrait_url, h.image_url) as image, pv.cnt::int as views
      from (
        select split_part(path, '/', 3) as hid, count(*) as cnt
        from public.page_views
        where not is_bot and created_at >= v_since and path like '/character/%'
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
      where not pv.is_bot
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
        where pv.session_id = sa.session_id and pv.created_at >= v_since and not pv.is_bot
      ) s on true
      where sa.first_seen >= v_since and s.views > 0
      group by 1, 2, 3
      order by count(distinct sa.session_id) desc
      limit 10
    ) r)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_activity_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 40, p_kind text DEFAULT 'all'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  is_admin boolean := exists (
    select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin
  );
  v_limit  int := least(greatest(coalesce(p_limit, 40), 1), 200);
  v_before timestamptz := coalesce(p_before, now() + interval '1 minute');
  v_kind   text := coalesce(p_kind, 'all');
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'items', (select coalesce(json_agg(r), '[]'::json) from (
      select * from (
        select 'view'::text as kind,
               pv.created_at as at,
               h.id   as "heroId",
               h.name as "heroName",
               pv.route, pv.path,
               pv.session_id as "sessionId",
               (pv.user_id is not null) as "signedIn",
               pv.country, pv.city, pv.device, pv.browser, pv.os,
               null::bigint as "runId", null::text as "runStatus", null::int as "runDone",
               null::text as text
          from public.page_views pv
          left join public.heroes h
            on pv.path like '/character/%' and h.id = split_part(pv.path, '/', 3)
          where v_kind in ('all', 'view') and pv.created_at < v_before and not pv.is_bot
          order by pv.created_at desc
          limit v_limit
      ) v
      union all
      select * from (
        select 'favourite'::text, f.created_at, h.id, h.name,
               null::text, null::text, null::text, true, null::text, null::text, null::text, null::text, null::text,
               null::bigint, null::text, null::int, null::text
          from public.user_favourites f join public.heroes h on h.id = f.hero_id
          where v_kind in ('all', 'engagement') and f.created_at < v_before
          order by f.created_at desc
          limit v_limit
      ) f
      union all
      select * from (
        select 'vote'::text, mv.created_at, h.id, h.name,
               null::text, null::text, null::text, (mv.user_id is not null), null::text, null::text, null::text, null::text, null::text,
               null::bigint, null::text, null::int, null::text
          from public.matchup_votes mv join public.heroes h on h.id = mv.picked_id
          where v_kind in ('all', 'engagement') and mv.created_at < v_before
          order by mv.created_at desc
          limit v_limit
      ) mv
      union all
      select * from (
        select 'contribution'::text, c.created_at, h.id, h.name,
               null::text, null::text, null::text, true, null::text, null::text, null::text, null::text, null::text,
               null::bigint, null::text, null::int, coalesce('edited ' || c.target_field, c.kind)
          from public.contributions c join public.heroes h on h.id = c.hero_id
          where v_kind in ('all', 'engagement') and c.created_at < v_before
          order by c.created_at desc
          limit v_limit
      ) c
      union all
      select * from (
        select 'run'::text, er.created_at, null::text, null::text,
               null::text, null::text, null::text, null::boolean, null::text, null::text, null::text, null::text, null::text,
               er.id, er.status, er.done, er.run_type
          from public.enrichment_runs er
          where v_kind in ('all', 'run') and er.created_at < v_before
          order by er.created_at desc
          limit v_limit
      ) er
      order by at desc
      limit v_limit
    ) r)
  );
end;
$function$;
