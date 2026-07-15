-- Extend admin_metric_cache (20260715073718) to the three remaining on-demand
-- aggregates the command center leans on. Audit: catalog_health gates 3 tabs
-- (~270ms cold), admin_community_overview 655ms mean / 7s max and POLLED every
-- 30s, get_source_coverage does 20 count(*) scans. Same pattern that took
-- enrichment_progress to 1ms: a 5-min cron precomputes into the cache; the
-- public function serves the cached payload (live fallback if stale). Output
-- shapes byte-identical — no client change. Verified: catalog_health 270ms->2ms.

alter function public.catalog_health() rename to compute_catalog_health;

create or replace function public.catalog_health()
returns jsonb language plpgsql stable set search_path to 'public'
as $$
declare cached record;
begin
  select payload, computed_at into cached from admin_metric_cache where key = 'catalog_health';
  if found and cached.computed_at > now() - interval '15 minutes' then return cached.payload; end if;
  return public.compute_catalog_health();
end;
$$;

alter function public.get_source_coverage() rename to compute_get_source_coverage;

create or replace function public.get_source_coverage()
returns json language plpgsql stable set search_path to 'public'
as $$
declare cached record;
begin
  select payload, computed_at into cached from admin_metric_cache where key = 'source_coverage';
  if found and cached.computed_at > now() - interval '15 minutes' then return cached.payload::json; end if;
  return public.compute_get_source_coverage();
end;
$$;

-- community: gated. compute_ is the prior payload body minus the gate; the
-- wrapper keeps the is_admin gate so a non-admin never reads the cached payload.
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
    'online', json_build_object(
      'onlineNow',(select count(*) from public.user_profiles where last_seen_at > now() - interval '5 minutes'),
      'activeToday',(select count(*) from public.user_profiles where last_seen_at > now() - interval '1 day'),
      'activeVisitors',(select count(distinct coalesce(user_id::text, session_id))::int from public.page_views where created_at > now() - interval '5 minutes'),
      'recent',(select coalesce(json_agg(r),'[]'::json) from (
        select id as "userId", display_name as "displayName", last_seen_at as "lastSeenAt",
               (last_seen_at > now() - interval '5 minutes') as "live"
        from public.user_profiles where last_seen_at is not null order by last_seen_at desc limit 8) r)),
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

create or replace function public.admin_community_overview()
returns json language plpgsql stable security definer set search_path to 'public'
as $$
declare
  is_admin boolean := exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin);
  cached record;
begin
  if not is_admin then return json_build_object('authorized', false); end if;
  select payload, computed_at into cached from admin_metric_cache where key = 'community_overview';
  if found and cached.computed_at > now() - interval '15 minutes' then return cached.payload::json; end if;
  return public.compute_admin_community_overview();
end;
$$;

create or replace function public.refresh_admin_metrics()
returns void language sql security definer set search_path to 'public'
as $$
  insert into admin_metric_cache (key, payload, computed_at) values
    ('enrichment_progress', public.compute_enrichment_progress(),            now()),
    ('catalog_health',      public.compute_catalog_health(),                 now()),
    ('source_coverage',     public.compute_get_source_coverage()::jsonb,     now()),
    ('community_overview',  public.compute_admin_community_overview()::jsonb, now())
  on conflict (key) do update set payload = excluded.payload, computed_at = excluded.computed_at;
$$;
revoke execute on function public.refresh_admin_metrics() from public, anon, authenticated;

select public.refresh_admin_metrics();
