-- Per-user "Battle Record" for the profile: aggregates the caller's matchup
-- votes into total cast, how often they sided with the crowd, and a current
-- daily-vote streak. Read-only, SECURITY DEFINER so it sees all votes (to compute
-- the per-pair majority) past the per-user RLS on matchup_votes.
create or replace function public.get_my_battle_record()
returns json
language sql
security definer
set search_path = public
stable
as $$
  with mine as (
    select hero_a_id, hero_b_id, picked_id, created_at
    from public.matchup_votes
    where user_id = auth.uid()
  ),
  -- For each pair the caller voted on, count votes for their pick vs the other.
  tallies as (
    select m.hero_a_id, m.hero_b_id,
           count(*) filter (where v.picked_id =  m.picked_id) as for_mine,
           count(*) filter (where v.picked_id <> m.picked_id) as for_other
    from mine m
    join public.matchup_votes v
      on v.hero_a_id = m.hero_a_id and v.hero_b_id = m.hero_b_id
    group by m.hero_a_id, m.hero_b_id, m.picked_id
  ),
  days as (
    select distinct (created_at at time zone 'utc')::date as d from mine
  ),
  ordered as (
    select d, row_number() over (order by d desc) as rn from days
  ),
  -- Length of the consecutive run of voting days from the most recent day back.
  streak as (
    select count(*)::int as len
    from ordered, (select max(d) as md from days) x
    where ordered.d = x.md - (ordered.rn - 1)::int
  )
  select json_build_object(
    'total', (select count(*) from mine),
    'agree', (select count(*) from tallies where for_mine > for_other),
    -- A streak only "counts" if the latest vote was today or yesterday.
    'streak', case
      when (select max(d) from days) >= current_date - 1 then (select len from streak)
      else 0
    end
  );
$$;

revoke all on function public.get_my_battle_record() from public, anon;
grant execute on function public.get_my_battle_record() to authenticated, service_role;
