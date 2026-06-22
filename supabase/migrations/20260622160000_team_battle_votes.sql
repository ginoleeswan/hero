-- "Which team wins?" votes. Verbatim mirror of matchup_votes, keyed on team ids.
create table if not exists public.team_battle_votes (
  team_a_id      text not null,
  team_b_id      text not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  picked_team_id text not null,
  created_at     timestamptz not null default now(),
  primary key (team_a_id, team_b_id, user_id),
  constraint team_battle_votes_pair_ordered check (team_a_id <= team_b_id),
  constraint team_battle_votes_pick_in_pair check (picked_team_id in (team_a_id, team_b_id))
);
create index if not exists team_battle_votes_user_idx on public.team_battle_votes (user_id);

alter table public.team_battle_votes enable row level security;
drop policy if exists team_battle_votes_own_select on public.team_battle_votes;
create policy team_battle_votes_own_select on public.team_battle_votes
  for select to authenticated using (user_id = auth.uid());
drop policy if exists team_battle_votes_own_write on public.team_battle_votes;
create policy team_battle_votes_own_write on public.team_battle_votes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.get_team_battle_tally(p_a text, p_b text)
returns json language sql security definer set search_path = public stable as $$
  with norm as (select least(p_a, p_b) lo, greatest(p_a, p_b) hi)
  select json_build_object(
    'votes_a', count(*) filter (where v.picked_team_id = p_a),
    'votes_b', count(*) filter (where v.picked_team_id = p_b),
    'total',   count(v.picked_team_id),
    'my_pick', max(v.picked_team_id) filter (where v.user_id = auth.uid())
  )
  from norm n
  left join public.team_battle_votes v on v.team_a_id = n.lo and v.team_b_id = n.hi;
$$;

create or replace function public.cast_team_battle_vote(p_a text, p_b text, p_picked text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lo text := least(p_a, p_b);
  v_hi text := greatest(p_a, p_b);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_picked is distinct from p_a and p_picked is distinct from p_b then
    raise exception 'pick must be one of the two teams';
  end if;
  insert into public.team_battle_votes (team_a_id, team_b_id, user_id, picked_team_id, created_at)
  values (v_lo, v_hi, v_uid, p_picked, now())
  on conflict (team_a_id, team_b_id, user_id)
  do update set picked_team_id = excluded.picked_team_id, created_at = now();
  return public.get_team_battle_tally(p_a, p_b);
end;
$$;

revoke all on function public.get_team_battle_tally(text, text)        from public, anon;
revoke all on function public.cast_team_battle_vote(text, text, text)  from public, anon;
grant execute on function public.get_team_battle_tally(text, text)       to authenticated, service_role;
grant execute on function public.cast_team_battle_vote(text, text, text) to authenticated, service_role;
