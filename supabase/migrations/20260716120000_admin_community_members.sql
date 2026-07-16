-- Command-center "Community" domain: deeper member/profile visibility.
--
-- Builds on the cached-metrics architecture from 20260715114900: the public
-- admin_community_overview() is a thin admin-gated cache wrapper; the real body
-- lives in compute_admin_community_overview() and is refreshed every 5 min by
-- refresh_admin_metrics(). So we extend the compute_ body (NOT the wrapper) and
-- re-run the refresh so the new shape is served immediately.
--
-- Two additive changes:
--   1. compute_admin_community_overview() gains a `members` roster (all profiles,
--      richest-signal first) with per-member engagement counts, a `newThisWeek`
--      signal, and avatar/role fields on the existing online.recent rows.
--      `activeVisitors` and every other key are preserved byte-for-byte.
--   2. New admin_member_detail(uuid) powers the roster drill-down.
--
-- Notes:
--   * verdicts (compares) carry no user_id, so they're omitted from per-member
--     feeds — favourites/views/votes/contributions all have user_id.
--   * matchup_votes.user_id is nullable (anon votes dedupe by device key), so the
--     per-member vote count filters `user_id is not null`.
--   * Roster capped at 60 rows to keep the aggregate one cheap query.

create or replace function public.compute_admin_community_overview()
returns json language sql stable security definer set search_path to 'public'
as $$
  select json_build_object(
    'authorized', true,
    'totals', json_build_object(
      'members',(select count(*) from public.user_profiles),
      'favourites',(select count(*) from public.user_favourites),
      'views',(select count(*) from public.user_view_history),
      'compares',(select count(*) from public.verdicts),
      'votes',(select count(*) from public.matchup_votes),
      'contributions',(select count(*) from public.contributions)),
    'newThisWeek',(select count(*)::int from public.user_profiles where created_at > now() - interval '7 days'),
    'online', json_build_object(
      'onlineNow',(select count(*) from public.user_profiles where last_seen_at > now() - interval '5 minutes'),
      'activeToday',(select count(*) from public.user_profiles where last_seen_at > now() - interval '1 day'),
      'activeVisitors',(select count(distinct coalesce(user_id::text, session_id))::int from public.page_views where created_at > now() - interval '5 minutes'),
      'recent',(select coalesce(json_agg(r),'[]'::json) from (
        select id as "userId", display_name as "displayName", avatar_url as "avatarUrl",
               is_admin as "isAdmin", is_supporter as "isSupporter", created_at as "joinedAt",
               last_seen_at as "lastSeenAt",
               (last_seen_at > now() - interval '5 minutes') as "live"
        from public.user_profiles where last_seen_at is not null order by last_seen_at desc limit 8) r)),
    'members',(select coalesce(json_agg(r),'[]'::json) from (
      select p.id as "userId", p.display_name as "displayName", p.avatar_url as "avatarUrl",
             p.is_admin as "isAdmin", p.is_supporter as "isSupporter", p.supporter_since as "supporterSince",
             p.created_at as "joinedAt", p.last_seen_at as "lastSeenAt",
             (p.last_seen_at > now() - interval '5 minutes') as "live",
             cs.level as "contributorLevel",
             coalesce(fv.n,0) as favourites, coalesce(vw.n,0) as views,
             coalesce(vt.n,0) as votes, coalesce(co.n,0) as contributions
      from public.user_profiles p
      left join public.contributor_stats cs on cs.user_id = p.id
      left join (select user_id, count(*)::int n from public.user_favourites group by user_id) fv on fv.user_id = p.id
      left join (select user_id, count(*)::int n from public.user_view_history group by user_id) vw on vw.user_id = p.id
      left join (select user_id, count(*)::int n from public.matchup_votes where user_id is not null group by user_id) vt on vt.user_id = p.id
      left join (select user_id, count(*)::int n from public.contributions group by user_id) co on co.user_id = p.id
      order by p.last_seen_at desc nulls last, p.created_at desc limit 60) r),
    'topViewed',(select coalesce(json_agg(r),'[]'::json) from (
      select h.id,h.name,h.image_url,h.publisher,count(*)::int as count
      from public.user_view_history v join public.heroes h on h.id=v.hero_id
      group by h.id,h.name,h.image_url,h.publisher order by count(*) desc limit 8) r),
    'topFavourited',(select coalesce(json_agg(r),'[]'::json) from (
      select h.id,h.name,h.image_url,h.publisher,count(*)::int as count
      from public.user_favourites f join public.heroes h on h.id=f.hero_id
      group by h.id,h.name,h.image_url,h.publisher order by count(*) desc limit 8) r),
    'topBacked',(select coalesce(json_agg(r),'[]'::json) from (
      with picks as (select picked_id as hero_id,count(*)::int as picked from public.matchup_votes group by picked_id),
      appearances as (select hero_id,count(*)::int as total from (
        select hero_a_id as hero_id from public.matchup_votes union all select hero_b_id from public.matchup_votes) a group by hero_id)
      select h.id,h.name,h.image_url,h.publisher,p.picked as count,
             case when ap.total>0 then round(100.0*p.picked/ap.total)::int else null end as "winRate"
      from picks p join public.heroes h on h.id=p.hero_id left join appearances ap on ap.hero_id=p.hero_id
      order by p.picked desc limit 8) r),
    'topContributors',(select coalesce(json_agg(r),'[]'::json) from (
      select cs.user_id as "userId", p.display_name as "displayName", cs.approved, cs.level
      from public.contributor_stats cs left join public.user_profiles p on p.id=cs.user_id
      order by cs.approved desc, cs.updated_at desc limit 8) r),
    'contributionsByStatus',(select json_build_object(
      'pending',count(*) filter (where status='pending'),
      'approved',count(*) filter (where status='approved'),
      'rejected',count(*) filter (where status='rejected')) from public.contributions),
    'recent',(select coalesce(json_agg(r),'[]'::json) from (
      select kind,at,"heroId","heroName",text from (
        select 'view'::text as kind, v.viewed_at as at, h.id as "heroId", h.name as "heroName", null::text as text
          from public.user_view_history v join public.heroes h on h.id=v.hero_id
        union all select 'favourite', f.created_at, h.id, h.name, null
          from public.user_favourites f join public.heroes h on h.id=f.hero_id
        union all select 'vote', mv.created_at, h.id, h.name, null
          from public.matchup_votes mv join public.heroes h on h.id=mv.picked_id
        union all select 'compare', vd.created_at, h.id, h.name, vd.verdict
          from public.verdicts vd join public.heroes h on h.id=vd.hero_a_id
        union all select 'contribution', c.created_at, h.id, h.name, coalesce('edited '||c.target_field,c.kind)
          from public.contributions c join public.heroes h on h.id=c.hero_id
      ) u order by at desc nulls last limit 12) r));
$$;

-- Per-member drill-down for the roster. Admin-gated (not cached — one row on
-- demand). Returns { authorized:false } for non-admins; otherwise the member's
-- profile, lifetime counts, recent favourites, and a member-scoped feed.
create or replace function public.admin_member_detail(p_user_id uuid)
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
    'profile', (
      select json_build_object(
        'userId', p.id,
        'displayName', p.display_name,
        'avatarUrl', p.avatar_url,
        'coverUrl', p.cover_url,
        'isAdmin', p.is_admin,
        'isSupporter', p.is_supporter,
        'supporterSince', p.supporter_since,
        'joinedAt', p.created_at,
        'lastSeenAt', p.last_seen_at,
        'live', (p.last_seen_at > now() - interval '5 minutes'),
        'contributorLevel', cs.level,
        'counts', json_build_object(
          'favourites',    (select count(*)::int from public.user_favourites where user_id = p.id),
          'views',         (select count(*)::int from public.user_view_history where user_id = p.id),
          'votes',         (select count(*)::int from public.matchup_votes where user_id = p.id),
          'contributions', (select count(*)::int from public.contributions where user_id = p.id),
          'approved',      coalesce(cs.approved, 0),
          'pending',       coalesce(cs.pending, 0),
          'rejected',      coalesce(cs.rejected, 0)
        )
      )
      from public.user_profiles p
      left join public.contributor_stats cs on cs.user_id = p.id
      where p.id = p_user_id
    ),
    'favourites', (select coalesce(json_agg(r), '[]'::json) from (
      select h.id, h.name, h.image_url, h.publisher, f.created_at as at
      from public.user_favourites f join public.heroes h on h.id = f.hero_id
      where f.user_id = p_user_id
      order by f.created_at desc
      limit 12
    ) r),
    'recent', (select coalesce(json_agg(r), '[]'::json) from (
      select kind, at, "heroId", "heroName", text from (
        select 'view'::text as kind, v.viewed_at as at,
               h.id as "heroId", h.name as "heroName", null::text as text
          from public.user_view_history v join public.heroes h on h.id = v.hero_id
          where v.user_id = p_user_id
        union all
        select 'favourite', f.created_at, h.id, h.name, null
          from public.user_favourites f join public.heroes h on h.id = f.hero_id
          where f.user_id = p_user_id
        union all
        select 'vote', mv.created_at, h.id, h.name, null
          from public.matchup_votes mv join public.heroes h on h.id = mv.picked_id
          where mv.user_id = p_user_id
        union all
        select 'contribution', c.created_at, h.id, h.name,
               coalesce('edited ' || c.target_field, c.kind)
          from public.contributions c join public.heroes h on h.id = c.hero_id
          where c.user_id = p_user_id
      ) u
      order by at desc nulls last
      limit 15
    ) r)
  );
end;
$$;

revoke all on function public.admin_member_detail(uuid) from public, anon;
grant execute on function public.admin_member_detail(uuid) to authenticated, service_role;

-- Repopulate the cache so the new members/newThisWeek shape is served at once
-- (the wrapper serves cached payloads for up to 15 min otherwise).
select public.refresh_admin_metrics();
