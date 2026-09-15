-- Audience enrichment + activity history for the command center.
--
-- 1. page_views grows the visitor context the client already knows (browser,
--    OS, language, timezone, viewport) plus coarse geo (country / region / city)
--    that /api/geo reads off Vercel's edge headers. No IP is ever stored; the
--    session id stays the same random client-persisted token as before, so the
--    privacy model (insert-only, read only through admin RPCs) is unchanged.
-- 2. admin_activity_feed — one cursor-paginated, cross-domain timeline (page
--    views · favourites · votes · contributions · enrichment runs), so the
--    "Live activity" panel can page back through history instead of showing
--    the last dozen rows of three independent streams.
-- 3. admin_audience_breakdown — where visitors are from, how they arrived,
--    what they use, and when they come, for one date window.
-- 4. admin_audience_sessions — the per-visitor drill-down: one row per browser
--    session with geo, device, first-touch attribution and the ordered page
--    trail, filterable by country / device / browser / source and cursor-paged.
--
-- All three RPCs are SECURITY DEFINER and re-verify is_admin; a non-admin gets
-- '{"authorized": false}' (or an empty array), never data.

alter table public.page_views
  add column if not exists country  text,   -- ISO 3166-1 alpha-2, from x-vercel-ip-country
  add column if not exists region   text,   -- x-vercel-ip-country-region (state / province)
  add column if not exists city     text,   -- x-vercel-ip-city (URL-decoded client-side)
  add column if not exists timezone text,   -- Intl resolved timezone, e.g. Europe/London
  add column if not exists browser  text,   -- 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | …
  add column if not exists os       text,   -- 'iOS' | 'Android' | 'macOS' | 'Windows' | …
  add column if not exists lang     text,   -- navigator.language, e.g. en-GB
  add column if not exists screen_w integer,
  add column if not exists screen_h integer;

create index if not exists page_views_session_created_idx
  on public.page_views (session_id, created_at desc);
create index if not exists page_views_country_idx
  on public.page_views (country) where country is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cross-domain activity timeline, newest first, keyset-paged on `at`.
--   p_before  exclusive upper bound (the last row's `at` from the previous page)
--   p_limit   page size (capped at 200)
--   p_kind    'all' | 'view' | 'engagement' | 'run'
create or replace function public.admin_activity_feed(
  p_before timestamptz default null,
  p_limit  integer     default 40,
  p_kind   text        default 'all'
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
        -- Page views: the visitor pulse, with the enriched context inline so a
        -- row can say "Viewing Batman · Berlin · mobile Safari".
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
          where v_kind in ('all', 'view') and pv.created_at < v_before
          order by pv.created_at desc
          limit v_limit
      ) v
      union all
      select * from (
        select 'favourite', f.created_at, h.id, h.name,
               null, null, null, true, null, null, null, null, null,
               null, null, null, null
          from public.user_favourites f join public.heroes h on h.id = f.hero_id
          where v_kind in ('all', 'engagement') and f.created_at < v_before
          order by f.created_at desc
          limit v_limit
      ) f
      union all
      select * from (
        select 'vote', mv.created_at, h.id, h.name,
               null, null, null, (mv.user_id is not null), null, null, null, null, null,
               null, null, null, null
          from public.matchup_votes mv join public.heroes h on h.id = mv.picked_id
          where v_kind in ('all', 'engagement') and mv.created_at < v_before
          order by mv.created_at desc
          limit v_limit
      ) mv
      union all
      select * from (
        select 'contribution', c.created_at, h.id, h.name,
               null, null, null, true, null, null, null, null, null,
               null, null, null, coalesce('edited ' || c.target_field, c.kind)
          from public.contributions c join public.heroes h on h.id = c.hero_id
          where v_kind in ('all', 'engagement') and c.created_at < v_before
          order by c.created_at desc
          limit v_limit
      ) c
      union all
      select * from (
        select 'run', er.created_at, null, null,
               null, null, null, null, null, null, null, null, null,
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

revoke all on function public.admin_activity_feed(timestamptz, int, text) from public, anon;
grant execute on function public.admin_activity_feed(timestamptz, int, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Audience breakdown for the last p_days calendar days. Every list is
-- "visitors" (distinct sessions) first, views second, so the panels answer
-- "how many PEOPLE" rather than "how many hits".
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
      where created_at >= v_since and session_id is not null
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
        'avgMinutes', round(coalesce(avg(extract(epoch from (last_at - first_at)) / 60.0)
                                       filter (where views > 1), 0)::numeric, 1),
        'countries',  (select count(distinct country) from pv where country is not null)
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
        left join lateral (
          select p.referrer from pv p
          where p.session_id = s.session_id and p.referrer is not null and p.referrer <> ''
          order by p.created_at limit 1
        ) pvr on true
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
          select s.session_id, s.views,
                 (select p.path from pv p where p.session_id = s.session_id
                   order by p.created_at limit 1) as first_path
          from sess s
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

revoke all on function public.admin_audience_breakdown(int) from public, anon;
grant execute on function public.admin_audience_breakdown(int) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-session drill-down. One row per browser session active in the window,
-- most recently active first, keyset-paged on last_at. Filters match the
-- session's dominant value (the most recent non-null one) so tapping a
-- breakdown row ("Germany", "mobile", "Safari", "reddit.com") lists exactly the
-- people behind that bar.
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
        where created_at >= v_since and session_id is not null
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

revoke all on function public.admin_audience_sessions(int, timestamptz, int, text, text, text, text) from public, anon;
grant execute on function public.admin_audience_sessions(int, timestamptz, int, text, text, text, text) to authenticated, service_role;
