-- Daily streaks — the retention backbone tying the three daily surfaces
-- (puzzle / daily debate vote / daily team-battle vote) into one per-user
-- completion calendar and a streak. Completing ANY surface counts the day;
-- a "perfect day" (all three) is left for a future badge.
--
-- Identity: signed-in only. Logged-out users keep the existing local-only
-- puzzle streak (AsyncStorage) — there is no cross-surface anon identity
-- (voter_key covers debate votes only), so the server calendar starts at auth.
--
-- Writes go through record_daily_completion() (SECURITY DEFINER, auth-required,
-- always stamps the CURRENT UTC day — no backfilling). Honour-system on the
-- puzzle, same posture as record_daily_result ("the puzzle is honour-system,
-- not a server secret"). Reads via get_my_daily_streak(); the push cron uses
-- get_streaks_at_risk() (service-role only) for the "streak on the line" nudge.

create table if not exists public.user_daily_completions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  surface    text not null check (surface in ('puzzle', 'debate', 'team_battle')),
  created_at timestamptz not null default now(),
  primary key (user_id, day, surface)
);

alter table public.user_daily_completions enable row level security;

-- Own-row reads only ((select auth.uid()) = InitPlan form, per the RLS-initplan
-- lesson). No insert/update/delete policies — writes are RPC-only.
drop policy if exists udc_select on public.user_daily_completions;
create policy udc_select on public.user_daily_completions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.user_daily_completions from anon, authenticated;

-- ── record_daily_completion ──────────────────────────────────────────────────
create or replace function public.record_daily_completion(p_surface text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_surface not in ('puzzle', 'debate', 'team_battle') then
    raise exception 'unknown surface %', p_surface;
  end if;
  insert into user_daily_completions (user_id, day, surface)
  values (auth.uid(), current_date, p_surface)
  on conflict (user_id, day, surface) do nothing;
end;
$function$;

-- ── get_my_daily_streak ──────────────────────────────────────────────────────
-- { current, longest, today: { puzzle, debate, team_battle } }
-- `current` counts the consecutive-day island whose last day is today OR
-- yesterday (the standard grace: today isn't over yet).
create or replace function public.get_my_daily_streak()
returns json
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_current int;
  v_longest int;
begin
  if v_uid is null then
    return json_build_object('current', 0, 'longest', 0,
      'today', json_build_object('puzzle', false, 'debate', false, 'team_battle', false));
  end if;

  with days as (
    select distinct day from user_daily_completions where user_id = v_uid
  ), grp as (
    select day, day - (row_number() over (order by day))::int as g from days
  ), islands as (
    select max(day) as fin, count(*)::int as len from grp group by g
  )
  select
    coalesce((select len from islands where fin >= current_date - 1 order by fin desc limit 1), 0),
    coalesce((select max(len) from islands), 0)
  into v_current, v_longest;

  return json_build_object(
    'current', v_current,
    'longest', v_longest,
    'today', (select json_build_object(
      'puzzle',      coalesce(bool_or(surface = 'puzzle'), false),
      'debate',      coalesce(bool_or(surface = 'debate'), false),
      'team_battle', coalesce(bool_or(surface = 'team_battle'), false)
    ) from user_daily_completions
      where user_id = v_uid and day = current_date)
  );
end;
$function$;

-- ── get_streaks_at_risk ──────────────────────────────────────────────────────
-- Users whose streak island ends EXACTLY yesterday (nothing yet today) with
-- length >= p_min — the "streak on the line" push audience. Service-role only
-- (called by the send-daily-push cron); never client-visible.
create or replace function public.get_streaks_at_risk(p_min integer default 3)
returns table (user_id uuid, streak integer)
language sql
stable
security definer
set search_path = public
as $function$
  with days as (
    select distinct udc.user_id, udc.day from user_daily_completions udc
  ), grp as (
    select days.user_id, days.day,
           days.day - (row_number() over (partition by days.user_id order by days.day))::int as g
    from days
  ), islands as (
    select grp.user_id, max(grp.day) as fin, count(*)::int as len
    from grp group by grp.user_id, grp.g
  )
  select islands.user_id, islands.len
  from islands
  where islands.fin = current_date - 1 and islands.len >= greatest(p_min, 1);
$function$;

-- Grants: recorder + reader for signed-in users; at-risk sweep for the cron only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.record_daily_completion(text)',
    'public.get_my_daily_streak()'
  ]
  loop
    execute format('revoke all on function %s from public, anon;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
  revoke all on function public.get_streaks_at_risk(integer) from public, anon, authenticated;
  grant execute on function public.get_streaks_at_risk(integer) to service_role;
end $$;
