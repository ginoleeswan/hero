-- Traffic analytics read layer for the command-center "Traffic" domain, plus a
-- small extension to the Community domain's presence block.
--
-- 1. admin_traffic_overview(p_days) — one admin-guarded SECURITY DEFINER round
--    trip aggregating public.page_views into totals / daily series / top pages /
--    top referrers / device split, plus a live "active now" count. Mirrors the
--    admin_community_overview pattern (authorized:false for non-admins).
-- 2. admin_community_overview() re-stated to add online.activeVisitors (distinct
--    visitors seen in page_views in the last 5 min) so the "Online now" panel can
--    show anonymous traffic alongside named-user presence.

create or replace function public.admin_traffic_overview(p_days int default 28)
returns json language plpgsql security definer set search_path = public stable
as $$
declare
  is_admin boolean := exists (
    select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin
  );
  v_since timestamptz := (current_date - make_interval(days => greatest(p_days, 1) - 1));
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'rangeDays', greatest(p_days, 1),
    'totals', (select json_build_object(
      'pageViews', count(*),
      'visitors',  count(distinct coalesce(user_id::text, session_id))
    ) from public.page_views where created_at >= v_since),
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
    ) r)
  );
end;
$$;

revoke all on function public.admin_traffic_overview(int) from public, anon;
grant execute on function public.admin_traffic_overview(int) to authenticated, service_role;

-- ── Community overview: add online.activeVisitors (page_views, last 5 min) ──────
-- Re-stated in full (migrations are append-only); only the online block changes
-- vs 20260623130000.
create or replace function public.admin_community_overview()
returns json language plpgsql security definer set search_path = public stable
as $$
declare
  is_admin boolean := exists (
    select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin
  );
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'totals', json_build_object(
      'members',       (select count(*) from public.user_profiles),
      'favourites',    (select count(*) from public.user_favourites),
      'views',         (select count(*) from public.user_view_history),
      'compares',      (select count(*) from public.verdicts),
      'votes',         (select count(*) from public.matchup_votes),
      'contributions', (select count(*) from public.contributions)
    ),
    'online', json_build_object(
      'onlineNow',   (select count(*) from public.user_profiles
                        where last_seen_at > now() - interval '5 minutes'),
      'activeToday', (select count(*) from public.user_profiles
                        where last_seen_at > now() - interval '1 day'),
      -- Anonymous + signed-in visitors active in the last 5 min (from page_views).
      'activeVisitors', (select count(distinct coalesce(user_id::text, session_id))::int
                           from public.page_views where created_at > now() - interval '5 minutes'),
      'recent', (select coalesce(json_agg(r), '[]'::json) from (
        select id as "userId", display_name as "displayName",
               last_seen_at as "lastSeenAt",
               (last_seen_at > now() - interval '5 minutes') as "live"
        from public.user_profiles
        where last_seen_at is not null
        order by last_seen_at desc
        limit 8
      ) r)
    ),
    'topViewed', (select coalesce(json_agg(r), '[]'::json) from (
      select h.id, h.name, h.image_url, h.publisher, count(*)::int as count
      from public.user_view_history v
      join public.heroes h on h.id = v.hero_id
      group by h.id, h.name, h.image_url, h.publisher
      order by count(*) desc
      limit 8
    ) r),
    'topFavourited', (select coalesce(json_agg(r), '[]'::json) from (
      select h.id, h.name, h.image_url, h.publisher, count(*)::int as count
      from public.user_favourites f
      join public.heroes h on h.id = f.hero_id
      group by h.id, h.name, h.image_url, h.publisher
      order by count(*) desc
      limit 8
    ) r),
    'topBacked', (select coalesce(json_agg(r), '[]'::json) from (
      with picks as (
        select picked_id as hero_id, count(*)::int as picked
        from public.matchup_votes
        group by picked_id
      ),
      appearances as (
        select hero_id, count(*)::int as total from (
          select hero_a_id as hero_id from public.matchup_votes
          union all
          select hero_b_id from public.matchup_votes
        ) a
        group by hero_id
      )
      select h.id, h.name, h.image_url, h.publisher,
             p.picked as count,
             case when ap.total > 0 then round(100.0 * p.picked / ap.total)::int else null end as "winRate"
      from picks p
      join public.heroes h on h.id = p.hero_id
      left join appearances ap on ap.hero_id = p.hero_id
      order by p.picked desc
      limit 8
    ) r),
    'topContributors', (select coalesce(json_agg(r), '[]'::json) from (
      select cs.user_id as "userId", p.display_name as "displayName",
             cs.approved, cs.level
      from public.contributor_stats cs
      left join public.user_profiles p on p.id = cs.user_id
      order by cs.approved desc, cs.updated_at desc
      limit 8
    ) r),
    'contributionsByStatus', (select json_build_object(
      'pending',  count(*) filter (where status = 'pending'),
      'approved', count(*) filter (where status = 'approved'),
      'rejected', count(*) filter (where status = 'rejected')
    ) from public.contributions),
    'recent', (select coalesce(json_agg(r), '[]'::json) from (
      select kind, at, "heroId", "heroName", text from (
        select 'view'::text as kind, v.viewed_at as at,
               h.id as "heroId", h.name as "heroName", null::text as text
          from public.user_view_history v join public.heroes h on h.id = v.hero_id
        union all
        select 'favourite', f.created_at, h.id, h.name, null
          from public.user_favourites f join public.heroes h on h.id = f.hero_id
        union all
        select 'vote', mv.created_at, h.id, h.name, null
          from public.matchup_votes mv join public.heroes h on h.id = mv.picked_id
        union all
        select 'compare', vd.created_at, h.id, h.name, vd.verdict
          from public.verdicts vd join public.heroes h on h.id = vd.hero_a_id
        union all
        select 'contribution', c.created_at, h.id, h.name,
               coalesce('edited ' || c.target_field, c.kind)
          from public.contributions c join public.heroes h on h.id = c.hero_id
      ) u
      order by at desc nulls last
      limit 12
    ) r)
  );
end;
$$;

revoke all on function public.admin_community_overview() from public, anon;
grant execute on function public.admin_community_overview() to authenticated, service_role;
