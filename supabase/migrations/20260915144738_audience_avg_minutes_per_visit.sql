-- admin_audience_breakdown: avgMinutes per visit instead of per browser id.
--
-- The smoke test after 20260915141447 reported avgMinutes = 232 for a 28-day
-- window, because a "session" is the persistent per-browser id and a returning
-- visitor's first→last view spans days. Duration now averages over visits
-- (a 30-minute inactivity gap starts a new one). Everything else is unchanged.
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
        -- Per VISIT, not per browser id: a returning visitor's first→last view
        -- spans days, so the session-level span read as hundreds of minutes.
        -- A 30-minute gap between views starts a new visit; single-view visits
        -- have no duration and are excluded from the average.
        'avgMinutes', (select round(coalesce(avg(minutes) filter (where views > 1), 0)::numeric, 1)
          from (
            select count(*) as views,
                   extract(epoch from (max(created_at) - min(created_at))) / 60.0 as minutes
            from (
              select session_id, created_at,
                     sum(case when created_at - lag(created_at) over (partition by session_id order by created_at)
                                   > interval '30 minutes' then 1 else 0 end)
                       over (partition by session_id order by created_at rows unbounded preceding) as visit_no
              from pv
            ) g
            group by session_id, visit_no
          ) visits),
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

