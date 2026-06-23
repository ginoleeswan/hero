-- Presence backbone for the command-center "who's online" view.
-- Two parts:
--   1. user_profiles.last_seen_at + a throttled heartbeat RPC (touch_last_seen),
--      called ~once/min by signed-in clients.
--   2. admin_community_overview() gains an `online` block (online now / active
--      today / most-recently-seen members), so the Community domain can show
--      named-user presence. Anonymous "active visitors" arrives with Phase 3's
--      page_views table.
-- The function is re-stated in full (CREATE OR REPLACE) because migrations are
-- append-only; the only change vs 20260623120000 is the added `online` key.

alter table public.user_profiles add column if not exists last_seen_at timestamptz;
create index if not exists user_profiles_last_seen_idx on public.user_profiles (last_seen_at desc);

-- Throttled heartbeat: stamps the caller's last_seen_at. Cheap; clients call it
-- on focus + on a ~60s interval. No-op (0 rows) for anon, which can't execute it.
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.user_profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated, service_role;

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
    -- Named-user presence. onlineNow = seen in the last 5 min; activeToday = 24h.
    'online', json_build_object(
      'onlineNow',   (select count(*) from public.user_profiles
                        where last_seen_at > now() - interval '5 minutes'),
      'activeToday', (select count(*) from public.user_profiles
                        where last_seen_at > now() - interval '1 day'),
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
