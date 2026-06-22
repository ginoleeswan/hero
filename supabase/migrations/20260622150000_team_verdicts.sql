-- AI verdict cache for team pairs. Mirror of public.verdicts; normalized key
-- (team_a_id <= team_b_id) so A-vs-B and B-vs-A share one row.
create table if not exists public.team_verdicts (
  team_a_id  text not null,
  team_b_id  text not null,
  verdict    text not null,
  created_at timestamptz not null default now(),
  primary key (team_a_id, team_b_id),
  constraint team_verdicts_pair_ordered check (team_a_id <= team_b_id)
);

alter table public.team_verdicts enable row level security;
drop policy if exists team_verdicts_select on public.team_verdicts;
create policy team_verdicts_select on public.team_verdicts for select using (true);
drop policy if exists team_verdicts_insert on public.team_verdicts;
create policy team_verdicts_insert on public.team_verdicts for insert with check (true);
