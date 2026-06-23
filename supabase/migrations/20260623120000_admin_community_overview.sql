-- Read-only community / engagement analytics for the Mythique Command Center's
-- "Community" domain. One admin-guarded SECURITY DEFINER round trip that
-- aggregates the per-user tables (each of which individually carries RLS) into a
-- single JSON object. Mirrors the established admin_* pattern: self-guards on
-- user_profiles.is_admin, returns { authorized:false } for everyone else, and is
-- revoked from anon. Leaderboards capped at 8, the activity feed at 12, so the
-- whole thing stays one cheap query.

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
    -- Most-viewed heroes (top 8 by distinct-or-not view rows).
    'topViewed', (select coalesce(json_agg(r), '[]'::json) from (
      select h.id, h.name, h.image_url, h.publisher, count(*)::int as count
      from public.user_view_history v
      join public.heroes h on h.id = v.hero_id
      group by h.id, h.name, h.image_url, h.publisher
      order by count(*) desc
      limit 8
    ) r),
    -- Most-favourited heroes (top 8).
    'topFavourited', (select coalesce(json_agg(r), '[]'::json) from (
      select h.id, h.name, h.image_url, h.publisher, count(*)::int as count
      from public.user_favourites f
      join public.heroes h on h.id = f.hero_id
      group by h.id, h.name, h.image_url, h.publisher
      order by count(*) desc
      limit 8
    ) r),
    -- Most-backed heroes: matchup_votes.picked_id tally + win rate
    -- (times picked / times appearing in any matchup as either side).
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
    -- Top contributors (pre-aggregated; read-only, no moderation here).
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
    -- Unified newest-first activity feed across the five engagement signals.
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
