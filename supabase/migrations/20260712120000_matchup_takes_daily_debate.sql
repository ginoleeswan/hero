-- Matchup Takes + Daily Debate backbone.
-- Spec: docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md
--
-- * Anonymous voting: authed votes stay in matchup_votes (per-user history,
--   battle record, community aggregations all keep working). Anonymous votes
--   land in matchup_votes_anon keyed by a client voter_key. The v2 RPCs union
--   the two at read time and route writes by auth.uid(). The v1 RPCs stay in
--   place until every client surface is confirmed on v2.
-- * Takes: pick-a-side one-liners, auth-only writes via post_take, public read
--   of visible rows. Agreements are voter_key-based so anon visitors can agree.
-- * daily_debate: server-curated source of truth for the daily pair, resolved
--   (split frozen, top take crowned) just after midnight UTC.

-- ── Anonymous votes ──────────────────────────────────────────────────────────
create table if not exists public.matchup_votes_anon (
  hero_a_id  text not null,
  hero_b_id  text not null,
  voter_key  text not null,
  picked_id  text not null,
  created_at timestamptz not null default now(),
  primary key (hero_a_id, hero_b_id, voter_key),
  constraint mva_pair_ordered check (hero_a_id <= hero_b_id),
  constraint mva_pick_in_pair check (picked_id in (hero_a_id, hero_b_id)),
  constraint mva_key_len check (char_length(voter_key) between 8 and 128)
);
create index if not exists mva_voter_recent_idx
  on public.matchup_votes_anon (voter_key, created_at desc);
alter table public.matchup_votes_anon enable row level security;
-- No policies: clients touch it only through the SECURITY DEFINER RPCs.

create or replace function public.get_matchup_tally_v2(
  p_a text, p_b text, p_voter_key text
) returns json
language sql security definer set search_path = public stable
as $$
  with norm as (select least(p_a, p_b) as lo, greatest(p_a, p_b) as hi),
  allv as (
    select v.picked_id, v.user_id::text as who, 'auth' as src
      from norm n join public.matchup_votes v
        on v.hero_a_id = n.lo and v.hero_b_id = n.hi
    union all
    select v.picked_id, v.voter_key as who, 'anon' as src
      from norm n join public.matchup_votes_anon v
        on v.hero_a_id = n.lo and v.hero_b_id = n.hi
  )
  select json_build_object(
    'votes_a', count(*) filter (where picked_id = p_a),
    'votes_b', count(*) filter (where picked_id = p_b),
    'total',   count(*),
    'my_pick', coalesce(
      max(picked_id) filter (where src = 'auth' and who = auth.uid()::text),
      max(picked_id) filter (where src = 'anon' and who = p_voter_key))
  ) from allv;
$$;

create or replace function public.cast_matchup_vote_v2(
  p_a text, p_b text, p_picked text, p_voter_key text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lo  text := least(p_a, p_b);
  v_hi  text := greatest(p_a, p_b);
begin
  if p_picked is distinct from p_a and p_picked is distinct from p_b then
    raise exception 'pick must be one of the two heroes';
  end if;
  if v_uid is not null then
    insert into public.matchup_votes (hero_a_id, hero_b_id, user_id, picked_id)
    values (v_lo, v_hi, v_uid, p_picked)
    on conflict (hero_a_id, hero_b_id, user_id)
      do update set picked_id = excluded.picked_id, created_at = now();
  else
    if p_voter_key is null or char_length(p_voter_key) < 8 then
      raise exception 'voter key required';
    end if;
    -- Fun-poll rate limit, not election security: 60 anon votes/hour per key.
    if (select count(*) from public.matchup_votes_anon
        where voter_key = p_voter_key
          and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'rate limited';
    end if;
    insert into public.matchup_votes_anon (hero_a_id, hero_b_id, voter_key, picked_id)
    values (v_lo, v_hi, p_voter_key, p_picked)
    on conflict (hero_a_id, hero_b_id, voter_key)
      do update set picked_id = excluded.picked_id, created_at = now();
  end if;
  return public.get_matchup_tally_v2(p_a, p_b, p_voter_key);
end;
$$;

revoke all on function public.get_matchup_tally_v2(text, text, text) from public;
revoke all on function public.cast_matchup_vote_v2(text, text, text, text) from public;
grant execute on function public.get_matchup_tally_v2(text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.cast_matchup_vote_v2(text, text, text, text)
  to anon, authenticated, service_role;

-- ── Takes ────────────────────────────────────────────────────────────────────
create table if not exists public.matchup_takes (
  id          uuid primary key default gen_random_uuid(),
  hero_a_id   text not null,
  hero_b_id   text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  picked_id   text not null,
  body        text not null,
  agree_count int  not null default 0,
  status      text not null default 'visible',
  created_at  timestamptz not null default now(),
  constraint takes_pair_ordered check (hero_a_id <= hero_b_id),
  constraint takes_pick_in_pair check (picked_id in (hero_a_id, hero_b_id)),
  constraint takes_body_len check (char_length(body) between 3 and 280),
  constraint takes_status_ok check (status in ('visible', 'hidden', 'removed')),
  constraint takes_one_per_user_pair unique (hero_a_id, hero_b_id, user_id)
);
create index if not exists takes_pair_idx
  on public.matchup_takes (hero_a_id, hero_b_id, status, agree_count desc);
create index if not exists takes_user_idx on public.matchup_takes (user_id);
alter table public.matchup_takes enable row level security;

drop policy if exists takes_public_read on public.matchup_takes;
create policy takes_public_read on public.matchup_takes
  for select using (status = 'visible' or user_id = auth.uid());
drop policy if exists takes_own_delete on public.matchup_takes;
create policy takes_own_delete on public.matchup_takes
  for delete to authenticated using (user_id = auth.uid());
-- Inserts only via post_take (validates + rate limits); no client updates.

create table if not exists public.take_agreements (
  take_id    uuid not null references public.matchup_takes (id) on delete cascade,
  voter_key  text not null,
  created_at timestamptz not null default now(),
  primary key (take_id, voter_key),
  constraint ta_key_len check (char_length(voter_key) between 8 and 128)
);
alter table public.take_agreements enable row level security;
-- RPC-only access.

create or replace function public.post_take(
  p_a text, p_b text, p_picked text, p_body text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_lo   text := least(p_a, p_b);
  v_hi   text := greatest(p_a, p_b);
  v_body text := regexp_replace(trim(p_body), '[\x00-\x1f\x7f]', ' ', 'g');
  v_row  public.matchup_takes;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_picked is distinct from p_a and p_picked is distinct from p_b then
    raise exception 'pick must be one of the two heroes';
  end if;
  if char_length(v_body) < 3 or char_length(v_body) > 280 then
    raise exception 'take must be 3-280 characters';
  end if;
  if (select count(*) from public.matchup_takes
      where user_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate limited';
  end if;
  insert into public.matchup_takes (hero_a_id, hero_b_id, user_id, picked_id, body)
  values (v_lo, v_hi, v_uid, p_picked, v_body)
  on conflict (hero_a_id, hero_b_id, user_id)
    do update set picked_id = excluded.picked_id, body = excluded.body,
                  created_at = now(), status = 'visible', agree_count = 0
  returning * into v_row;
  -- Re-posting resets agreements (it is a different take now). On a fresh
  -- insert this deletes zero rows, so it is safe to run unconditionally.
  delete from public.take_agreements where take_id = v_row.id;
  return row_to_json(v_row);
end;
$$;

create or replace function public.toggle_take_agreement(
  p_take_id uuid, p_voter_key text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_key   text := coalesce(auth.uid()::text, p_voter_key);
  v_on    boolean;
  v_count int;
begin
  if v_key is null or char_length(v_key) < 8 then
    raise exception 'voter key required';
  end if;
  if not exists (select 1 from public.matchup_takes
                 where id = p_take_id and status = 'visible') then
    raise exception 'take not found';
  end if;
  delete from public.take_agreements
    where take_id = p_take_id and voter_key = v_key;
  if not found then
    insert into public.take_agreements (take_id, voter_key)
    values (p_take_id, v_key);
    v_on := true;
  else
    v_on := false;
  end if;
  update public.matchup_takes t
     set agree_count = (select count(*) from public.take_agreements a
                        where a.take_id = t.id)
   where t.id = p_take_id
   returning agree_count into v_count;
  return json_build_object('agreed', v_on, 'agree_count', coalesce(v_count, 0));
end;
$$;

revoke all on function public.post_take(text, text, text, text) from public, anon;
grant execute on function public.post_take(text, text, text, text)
  to authenticated, service_role;
revoke all on function public.toggle_take_agreement(uuid, text) from public;
grant execute on function public.toggle_take_agreement(uuid, text)
  to anon, authenticated, service_role;

-- ── Daily debate ─────────────────────────────────────────────────────────────
create table if not exists public.daily_debate (
  debate_date   date primary key,
  hero_a_id     text not null references public.heroes (id) on delete cascade,
  hero_b_id     text not null references public.heroes (id) on delete cascade,
  hook_text     text,
  final_votes_a int,
  final_votes_b int,
  top_take_id   uuid references public.matchup_takes (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint dd_pair_ordered check (hero_a_id <= hero_b_id)
);
alter table public.daily_debate enable row level security;
drop policy if exists dd_public_read on public.daily_debate;
create policy dd_public_read on public.daily_debate for select using (true);

-- Admin curation (command center). Same inline gate the other admin RPCs use.
create or replace function public.set_daily_debate(
  p_date date, p_a text, p_b text, p_hook text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_profiles
                 where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_a = p_b then raise exception 'pick two different heroes'; end if;
  insert into public.daily_debate (debate_date, hero_a_id, hero_b_id, hook_text)
  values (p_date, least(p_a, p_b), greatest(p_a, p_b), nullif(trim(p_hook), ''))
  on conflict (debate_date)
    do update set hero_a_id = excluded.hero_a_id, hero_b_id = excluded.hero_b_id,
                  hook_text = excluded.hook_text,
                  final_votes_a = null, final_votes_b = null, top_take_id = null;
end;
$$;
revoke all on function public.set_daily_debate(date, text, text, text) from public, anon;
grant execute on function public.set_daily_debate(date, text, text, text)
  to authenticated, service_role;

-- Freeze past debates' splits + crown their top take.
create or replace function public.resolve_daily_debate()
returns void
language plpgsql security definer set search_path = public
as $$
declare d public.daily_debate;
begin
  for d in select * from public.daily_debate
           where debate_date < current_date and final_votes_a is null
  loop
    update public.daily_debate dd set
      final_votes_a = (
        select count(*) from (
          select picked_id from public.matchup_votes v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
          union all
          select picked_id from public.matchup_votes_anon v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
        ) x where x.picked_id = d.hero_a_id),
      final_votes_b = (
        select count(*) from (
          select picked_id from public.matchup_votes v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
          union all
          select picked_id from public.matchup_votes_anon v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
        ) x where x.picked_id = d.hero_b_id),
      top_take_id = (
        select id from public.matchup_takes t
         where t.hero_a_id = d.hero_a_id and t.hero_b_id = d.hero_b_id
           and t.status = 'visible'
         order by t.agree_count desc, t.created_at asc limit 1)
    where dd.debate_date = d.debate_date;
  end loop;
end;
$$;
revoke all on function public.resolve_daily_debate() from public, anon, authenticated;
grant execute on function public.resolve_daily_debate() to service_role;

-- Auto-pick fallback: high-fame enemy pair unused in the last 90 days. The
-- command-center picker (set_daily_debate) overrides this at any time.
create or replace function public.pick_daily_debate()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.daily_debate (debate_date, hero_a_id, hero_b_id)
  select current_date + 1, least(r.hero_id, r.related_id),
         greatest(r.hero_id, r.related_id)
  from public.hero_relationships r
  join public.heroes a on a.id = r.hero_id
  join public.heroes b on b.id = r.related_id
  where r.kind = 'enemy'
    and a.fame_score >= 60 and b.fame_score >= 60
    and a.portrait_url is not null and b.portrait_url is not null
    and not exists (
      select 1 from public.daily_debate dd
      where dd.debate_date > current_date - 90
        and dd.hero_a_id = least(r.hero_id, r.related_id)
        and dd.hero_b_id = greatest(r.hero_id, r.related_id))
  order by (a.fame_score + b.fame_score) desc, random()
  limit 1
  on conflict (debate_date) do nothing;
end;
$$;
revoke all on function public.pick_daily_debate() from public, anon, authenticated;
grant execute on function public.pick_daily_debate() to service_role;

-- Nightly, just after midnight UTC: freeze yesterday, ensure today + tomorrow
-- exist (double pick is idempotent thanks to on conflict do nothing; running
-- it for today too heals a missed night).
select cron.schedule('daily-debate-roll', '5 0 * * *', $$
  select public.resolve_daily_debate();
  select public.pick_daily_debate();
$$);

-- Seed today's debate so the surface is never dark before the first cron run.
insert into public.daily_debate (debate_date, hero_a_id, hero_b_id)
select current_date, least(r.hero_id, r.related_id), greatest(r.hero_id, r.related_id)
from public.hero_relationships r
join public.heroes a on a.id = r.hero_id
join public.heroes b on b.id = r.related_id
where r.kind = 'enemy'
  and a.fame_score >= 60 and b.fame_score >= 60
  and a.portrait_url is not null and b.portrait_url is not null
order by (a.fame_score + b.fame_score) desc, random()
limit 1
on conflict (debate_date) do nothing;

-- ── Take reports ─────────────────────────────────────────────────────────────
-- Extend the reports backbone with a 'take' target. Keep _report_reason_ok in
-- sync with REPORT_REASONS in src/lib/db/reports.ts.
alter table public.reports add column if not exists take_id uuid
  references public.matchup_takes (id) on delete cascade;
alter table public.reports drop constraint if exists reports_target_chk;
alter table public.reports add constraint reports_target_chk
  check (target_type in ('page', 'image', 'ai_portrait', 'take'));

create or replace function public._report_reason_ok(p_target text, p_reason text)
returns boolean language sql immutable as $$
  select case p_target
    when 'page'        then p_reason in ('inaccurate','offensive','duplicate','spam','other')
    when 'image'       then p_reason in ('wrong_subject','offensive','low_quality','other')
    when 'ai_portrait' then p_reason in ('ai_inaccurate','offensive','low_quality','other')
    when 'take'        then p_reason in ('offensive','spam','other')
    else false end;
$$;

-- Replace submit_report with a take-aware signature. Drop first: adding an
-- overload would make 5-arg PostgREST calls ambiguous.
drop function if exists public.submit_report(text, text, text, text, text);
create function public.submit_report(
  p_hero_id text, p_target_type text, p_image_url text, p_reason text,
  p_detail text, p_take_id uuid default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_img text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_detail text := nullif(btrim(coalesce(p_detail, '')), '');
  v_open int;
  v_id bigint;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_target_type not in ('page','image','ai_portrait','take') then raise exception 'invalid target'; end if;
  if not public._report_reason_ok(p_target_type, p_reason) then raise exception 'invalid reason'; end if;
  if not exists (select 1 from public.heroes where id = p_hero_id) then raise exception 'unknown hero'; end if;
  if p_target_type = 'take' then
    v_img := null;
    if p_take_id is null or not exists (
      select 1 from public.matchup_takes where id = p_take_id
    ) then raise exception 'unknown take'; end if;
  elsif p_target_type = 'page' then
    v_img := null;                                   -- page reports carry no image
  elsif v_img is null then
    raise exception 'image required';                -- image/ai reports must reference one
  end if;
  if p_reason = 'other' and v_detail is null then raise exception 'detail required'; end if;
  v_detail := left(v_detail, 1000);

  select count(*) into v_open from public.reports
    where user_id = v_uid and status = 'open';
  if v_open >= 30 then raise exception 'too many open reports'; end if;

  -- One open report per (user, hero, target, image/take).
  if exists (
    select 1 from public.reports
    where user_id = v_uid and hero_id = p_hero_id and status = 'open'
      and target_type = p_target_type
      and coalesce(image_url,'') = coalesce(v_img,'')
      and coalesce(take_id::text,'') = coalesce(p_take_id::text,'')
  ) then raise exception 'already reported'; end if;

  insert into public.reports (user_id, hero_id, target_type, image_url, reason, detail, take_id)
  values (v_uid, p_hero_id, p_target_type, v_img, p_reason, v_detail,
          case when p_target_type = 'take' then p_take_id else null end)
  returning id into v_id;

  return json_build_object('id', v_id, 'status', 'open');
end;
$$;
revoke all on function public.submit_report(text, text, text, text, text, uuid) from public, anon;
grant execute on function public.submit_report(text, text, text, text, text, uuid)
  to authenticated, service_role;
