-- admin_activity_feed: fix "UNION types bigint and text cannot be matched".
--
-- Each union branch is wrapped in its own subquery (for a per-branch ORDER BY /
-- LIMIT), and Postgres resolves an untyped NULL or string literal that reaches
-- a subquery's output list to TEXT before the UNION sees it. So the bare
-- `null` placeholders in the engagement/run branches arrived as text against
-- the first branch's bigint runId / int runDone / boolean signedIn. Every
-- placeholder is now cast to the column's real type. Caught by the smoke test
-- run right after the previous migration; the function body is otherwise
-- unchanged.
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
