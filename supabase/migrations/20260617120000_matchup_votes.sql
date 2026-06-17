-- Community "Who would win?" votes for the daily matchup (and any compare pair).
--
-- The explore "Today's Battle" card lets a user pick a winner; until now that
-- pick lived only in the client (AsyncStorage). This adds the backend so the
-- reveal can show a real crowd tally.
--
-- Design:
--   * One row per (normalized pair, user). The pair is normalized so that
--     hero_a_id <= hero_b_id, so A-vs-B and B-vs-A share a single tally — the
--     same convention the `verdicts` cache uses.
--   * The chosen hero is stored by id (`picked_id`), not "side A/B", so the
--     tally is order-independent and survives either display order.
--   * The table is locked by RLS to each user's own row; aggregate tallies are
--     read/written only through the two SECURITY DEFINER RPCs below (which pin
--     search_path and are revoked from PUBLIC + anon, matching the hardening
--     migration). Explore itself is publicly viewable, so the "Today's Battle"
--     card guards the vote action client-side and routes logged-out users to
--     sign in before these (authenticated-only) RPCs are ever called.

create table if not exists public.matchup_votes (
  hero_a_id  text not null,
  hero_b_id  text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  picked_id  text not null,
  created_at timestamptz not null default now(),
  primary key (hero_a_id, hero_b_id, user_id),
  constraint matchup_votes_pair_ordered check (hero_a_id <= hero_b_id),
  constraint matchup_votes_pick_in_pair check (picked_id in (hero_a_id, hero_b_id))
);

-- Lets the per-user policy filter (and an eventual "your picks" view) avoid a
-- full scan; the PK already covers the per-pair aggregate lookups.
create index if not exists matchup_votes_user_idx on public.matchup_votes (user_id);

alter table public.matchup_votes enable row level security;

drop policy if exists matchup_votes_own_select on public.matchup_votes;
create policy matchup_votes_own_select on public.matchup_votes
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists matchup_votes_own_write on public.matchup_votes;
create policy matchup_votes_own_write on public.matchup_votes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Read a pair's tally, relative to the caller's requested order ─────────────
-- Returns counts for p_a and p_b (the caller's order), the total, and the
-- caller's own pick (null when they haven't voted). Pair order is normalized
-- internally. STABLE + SECURITY DEFINER so it sees all rows past RLS.
create or replace function public.get_matchup_tally(p_a text, p_b text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  with norm as (
    select least(p_a, p_b) as lo, greatest(p_a, p_b) as hi
  )
  select json_build_object(
    'votes_a', count(*) filter (where v.picked_id = p_a),
    'votes_b', count(*) filter (where v.picked_id = p_b),
    'total',   count(v.picked_id),
    'my_pick', max(v.picked_id) filter (where v.user_id = auth.uid())
  )
  from norm n
  left join public.matchup_votes v
    on v.hero_a_id = n.lo and v.hero_b_id = n.hi;
$$;

-- ── Cast (or change) the caller's pick and return the fresh tally ─────────────
-- Requires auth; validates the pick is one of the two combatants; upserts so a
-- user has at most one vote per pair (and may switch sides).
create or replace function public.cast_matchup_vote(p_a text, p_b text, p_picked text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lo  text := least(p_a, p_b);
  v_hi  text := greatest(p_a, p_b);
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_picked is distinct from p_a and p_picked is distinct from p_b then
    raise exception 'pick must be one of the two heroes';
  end if;

  insert into public.matchup_votes (hero_a_id, hero_b_id, user_id, picked_id, created_at)
  values (v_lo, v_hi, v_uid, p_picked, now())
  on conflict (hero_a_id, hero_b_id, user_id)
  do update set picked_id = excluded.picked_id, created_at = now();

  return public.get_matchup_tally(p_a, p_b);
end;
$$;

-- Lock execution to authenticated users + service_role (mirrors the hardening
-- migration's policy for client-facing RPCs).
revoke all on function public.get_matchup_tally(text, text)        from public, anon;
revoke all on function public.cast_matchup_vote(text, text, text)  from public, anon;
grant execute on function public.get_matchup_tally(text, text)       to authenticated, service_role;
grant execute on function public.cast_matchup_vote(text, text, text) to authenticated, service_role;
