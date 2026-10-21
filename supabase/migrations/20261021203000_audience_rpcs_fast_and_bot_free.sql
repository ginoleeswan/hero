-- Audience › Visitors: make the breakdown fit the timeout, and drop bots.
--
-- admin_audience_breakdown(28) took ~18s against authenticated's 8s
-- statement_timeout, so the Visitors tab always failed to load. Two per-session
-- correlated subqueries (first referrer, landing page) rescanned the whole
-- window CTE once per session; after the 2026-09-15 crawl that was ~6.5k
-- sessions x ~7.3k rows each. They are now one DISTINCT ON pass apiece.
--
-- Both audience RPCs also now skip rows classify_bot_traffic() flagged
-- (20260915152115), which were ~89% of the last 28 days of page_views. The
-- breakdown reports how many bot sessions it left out (totals.botSessions).
-- Rows stay in page_views, so nothing is lost. Traffic and activity RPCs
-- are unchanged.

create or replace function public.admin_audience_breakdown(p_days integer default 28)
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
  v_days  int := greatest(coalesce(p_days, 28), 1);
  v_since timestamptz := (current_date - make_interval(days => v_days - 1));
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return (
    with pv as (
      select * from public.page_views
      where created_at >= v_since and session_id is not null and not is_bot
    ),
    -- First page + first referrer per session in one sorted pass each. These
    -- were correlated subqueries over pv, i.e. a full rescan per session.
    firsts as (
      select distinct on (session_id) session_id, path as first_path
      from pv order by session_id, created_at
    ),
    first_ref as (
      select distinct on (session_id) session_id, referrer
      from pv where referrer is not null and referrer <> ''
      order by session_id, created_at
    ),
    sess as (
      -- One row per browser session seen in the window.
      select session_id,
             min(created_at) as first_at,
             max(created_at) as last_at,
             count(*)        as views,
             bool_or(user_id is not null) as signed_in
      from pv group by session_id
    ),
    returning_flag as (
      -- "Returning" = the session was already seen BEFORE the window opened.
      select s.session_id,
             exists (select 1 from public.page_views p0
                      where p0.session_id = s.session_id and p0.created_at < v_since) as is_returning
      from sess s
    )
    select json_build_object(
      'authorized', true,
      'rangeDays', v_days,
      'totals', (select json_build_object(
        'sessions',   count(*),
        'signedIn',   count(*) filter (where signed_in),
        'bounced',    count(*) filter (where views = 1),
        'avgViews',   round(coalesce(avg(views), 0)::numeric, 1),
        -- Per VISIT, not per browser id: a returning visitor's first→last view
        -- spans days, so the session-level span read as hundreds of minutes.
        -- A 30-minute gap between views starts a new visit; single-view visits
        -- have no duration and are excluded from the average.
        'avgMinutes', (select round(coalesce(avg(minutes) filter (where views > 1), 0)::numeric, 1)
          from (
            select count(*) as views,
                   extract(epoch from (max(created_at) - min(created_at))) / 60.0 as minutes
            from (
              -- Two window passes: the gap flag first, then its running sum
              -- (Postgres does not allow a window call inside another).
              select session_id, created_at,
                     sum(starts_visit)
                       over (partition by session_id order by created_at rows unbounded preceding) as visit_no
              from (
                select session_id, created_at,
                       case when created_at - lag(created_at) over (partition by session_id order by created_at)
                                 > interval '30 minutes' then 1 else 0 end as starts_visit
                from pv
              ) gaps
            ) g
            group by session_id, visit_no
          ) visits),
        'countries',  (select count(distinct country) from pv where country is not null),
        -- Sessions classify_bot_traffic() marked in this window, kept out of
        -- every figure here; shown so the exclusion is visible, not silent.
        'botSessions', (select count(distinct p.session_id) from public.page_views p
                        where p.created_at >= v_since and p.is_bot)
      ) from sess),
      'newVsReturning', (select json_build_object(
        'new',       count(*) filter (where not is_returning),
        'returning', count(*) filter (where is_returning)
      ) from returning_flag),
      'countries', (select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(nullif(country, ''), 'unknown') as code,
               count(distinct session_id)::int as visitors, count(*)::int as views
        from pv group by 1 order by 2 desc, 3 desc limit 20
      ) r),
      'regions', (select coalesce(json_agg(r), '[]'::json) from (
        select country as code, region, count(distinct session_id)::int as visitors
        from pv where region is not null and region <> ''
        group by 1, 2 order by 3 desc limit 20
      ) r),
      'cities', (select coalesce(json_agg(r), '[]'::json) from (
        select country as code, city, count(distinct session_id)::int as visitors
        from pv where city is not null and city <> ''
        group by 1, 2 order by 3 desc limit 20
      ) r),
      'devices', (select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(nullif(device, ''), 'unknown') as label,
               count(distinct session_id)::int as visitors, count(*)::int as views
        from pv group by 1 order by 2 desc
      ) r),
      'browsers', (select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(nullif(browser, ''), 'unknown') as label,
               count(distinct session_id)::int as visitors, count(*)::int as views
        from pv group by 1 order by 2 desc limit 10
      ) r),
      'os', (select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(nullif(os, ''), 'unknown') as label,
               count(distinct session_id)::int as visitors, count(*)::int as views
        from pv group by 1 order by 2 desc limit 10
      ) r),
      'languages', (select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(nullif(lang, ''), 'unknown') as label,
               count(distinct session_id)::int as visitors
        from pv group by 1 order by 2 desc limit 10
      ) r),
      'timezones', (select coalesce(json_agg(r), '[]'::json) from (
        select timezone as label, count(distinct session_id)::int as visitors
        from pv where timezone is not null and timezone <> ''
        group by 1 order by 2 desc limit 10
      ) r),
      -- Viewport buckets, by the width the layout actually branches on.
      'screens', (select coalesce(json_agg(r), '[]'::json) from (
        select case
                 when screen_w is null then 'unknown'
                 when screen_w < 480  then 'phone (<480)'
                 when screen_w < 760  then 'large phone (480–759)'
                 when screen_w < 1024 then 'tablet (760–1023)'
                 when screen_w < 1440 then 'laptop (1024–1439)'
                 else 'desktop (1440+)'
               end as label,
               count(distinct session_id)::int as visitors
        from pv group by 1 order by 2 desc
      ) r),
      -- How they got here: first-touch attribution per session (UTM, else the
      -- referrer host, else direct). Left join keeps direct sessions counted.
      'sources', (select coalesce(json_agg(r), '[]'::json) from (
        select coalesce(nullif(sa.utm_source, ''), nullif(sa.referrer, ''),
                        nullif(pvr.referrer, ''), 'direct') as source,
               sa.utm_medium   as medium,
               sa.utm_campaign as campaign,
               count(*)::int as visitors,
               count(*) filter (where s.views > 1)::int as engaged,
               count(*) filter (where s.signed_in)::int as "signedIn"
        from sess s
        left join public.session_attribution sa on sa.session_id = s.session_id
        left join first_ref pvr on pvr.session_id = s.session_id
        group by 1, 2, 3 order by 4 desc limit 15
      ) r),
      'referrers', (select coalesce(json_agg(r), '[]'::json) from (
        select referrer as host, count(distinct session_id)::int as visitors, count(*)::int as views
        from pv where referrer is not null and referrer <> ''
        group by 1 order by 2 desc limit 15
      ) r),
      'landings', (select coalesce(json_agg(r), '[]'::json) from (
        select first_path as path, count(*)::int as sessions,
               count(*) filter (where views > 1)::int as engaged
        from (
          select s.session_id, s.views, f.first_path
          from sess s join firsts f on f.session_id = s.session_id
        ) l
        group by 1 order by 2 desc limit 15
      ) r),
      -- When: hour of day (UTC) and weekday (0 = Sunday), gap-filled.
      'hours', (select coalesce(json_agg(r order by r.hour), '[]'::json) from (
        select g.hour,
               count(distinct pv.session_id)::int as visitors,
               count(pv.id)::int as views
        from generate_series(0, 23) as g(hour)
        left join pv on extract(hour from pv.created_at)::int = g.hour
        group by g.hour
      ) r),
      'weekdays', (select coalesce(json_agg(r order by r.dow), '[]'::json) from (
        select g.dow,
               count(distinct pv.session_id)::int as visitors,
               count(pv.id)::int as views
        from generate_series(0, 6) as g(dow)
        left join pv on extract(dow from pv.created_at)::int = g.dow
        group by g.dow
      ) r)
    )
  );
end;

$function$;

create or replace function public.admin_audience_sessions(
  p_days    integer     default 28,
  p_before  timestamptz default null,
  p_limit   integer     default 25,
  p_country text        default null,
  p_device  text        default null,
  p_browser text        default null,
  p_source  text        default null
)
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
  v_days   int := greatest(coalesce(p_days, 28), 1);
  v_since  timestamptz := (current_date - make_interval(days => v_days - 1));
  v_limit  int := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_before timestamptz := coalesce(p_before, now() + interval '1 minute');
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'sessions', (select coalesce(json_agg(r), '[]'::json) from (
      with sess as (
        select session_id,
               min(created_at) as first_at,
               max(created_at) as last_at,
               count(*)::int   as views,
               bool_or(user_id is not null) as signed_in,
               (array_agg(user_id order by created_at desc) filter (where user_id is not null))[1] as user_id,
               (array_agg(country  order by created_at desc) filter (where country  is not null and country  <> ''))[1] as country,
               (array_agg(region   order by created_at desc) filter (where region   is not null and region   <> ''))[1] as region,
               (array_agg(city     order by created_at desc) filter (where city     is not null and city     <> ''))[1] as city,
               (array_agg(device   order by created_at desc) filter (where device   is not null and device   <> ''))[1] as device,
               (array_agg(browser  order by created_at desc) filter (where browser  is not null and browser  <> ''))[1] as browser,
               (array_agg(os       order by created_at desc) filter (where os       is not null and os       <> ''))[1] as os,
               (array_agg(lang     order by created_at desc) filter (where lang     is not null and lang     <> ''))[1] as lang,
               (array_agg(timezone order by created_at desc) filter (where timezone is not null and timezone <> ''))[1] as timezone,
               (array_agg(screen_w order by created_at desc) filter (where screen_w is not null))[1] as screen_w,
               (array_agg(screen_h order by created_at desc) filter (where screen_h is not null))[1] as screen_h,
               (array_agg(referrer order by created_at asc)  filter (where referrer is not null and referrer <> ''))[1] as referrer
        from public.page_views
        where created_at >= v_since and session_id is not null and not is_bot
        group by session_id
      )
      select s.session_id      as "sessionId",
             s.first_at        as "firstAt",
             s.last_at         as "lastAt",
             s.views,
             s.signed_in       as "signedIn",
             up.display_name   as "displayName",
             s.country, s.region, s.city,
             s.device, s.browser, s.os, s.lang, s.timezone,
             s.screen_w        as "screenW",
             s.screen_h        as "screenH",
             coalesce(nullif(sa.utm_source, ''), nullif(sa.referrer, ''), s.referrer, 'direct') as source,
             sa.utm_medium     as medium,
             sa.utm_campaign   as campaign,
             sa.landing_path   as landing,
             exists (select 1 from public.page_views p0
                      where p0.session_id = s.session_id and p0.created_at < v_since) as "returning",
             -- The ordered page trail (oldest → newest, capped at the last 20).
             (select coalesce(json_agg(t order by t.at), '[]'::json) from (
                select p.path, p.route, h.name, p.created_at as at
                from public.page_views p
                left join public.heroes h
                  on p.path like '/character/%' and h.id = split_part(p.path, '/', 3)
                where p.session_id = s.session_id and p.created_at >= v_since
                order by p.created_at desc
                limit 20
             ) t) as trail
      from sess s
      left join public.session_attribution sa on sa.session_id = s.session_id
      left join public.user_profiles up on up.id = s.user_id
      where s.last_at < v_before
        and (p_country is null or coalesce(s.country, 'unknown') = p_country)
        and (p_device  is null or coalesce(s.device,  'unknown') = p_device)
        and (p_browser is null or coalesce(s.browser, 'unknown') = p_browser)
        and (p_source  is null or
             coalesce(nullif(sa.utm_source, ''), nullif(sa.referrer, ''), s.referrer, 'direct') = p_source)
      order by s.last_at desc
      limit v_limit
    ) r)
  );
end;

$function$;
