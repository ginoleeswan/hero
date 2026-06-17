-- Community contributions backbone (Phase 2a of the profiles/contributions spec).
-- Review-queued, ALWAYS admin-vetted (no auto-approve). v1 intake is deliberately
-- narrow + low-risk: edit an allow-listed heroes text field, propose a
-- "Did You Know" fact, or flag bad data. Applied changes are attributed to the
-- community; reputation (contributor_stats.level) is cosmetic only.

create table if not exists public.contributions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  hero_id       text not null references public.heroes(id) on delete cascade,
  kind          text not null,        -- 'field' | 'fact' | 'report'
  target_field  text,                 -- for kind='field'
  old_value     text,                 -- snapshot at submit time
  new_value     text,                 -- proposed value / fact content
  note          text,                 -- submitter note / report reason
  status        text not null default 'pending',
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  constraint contributions_kind_chk   check (kind in ('field','fact','report')),
  constraint contributions_status_chk check (status in ('pending','approved','rejected','superseded'))
);
create index if not exists contributions_status_idx on public.contributions (status, created_at);
create index if not exists contributions_user_idx   on public.contributions (user_id);
create index if not exists contributions_hero_idx   on public.contributions (hero_id);

create table if not exists public.contributor_stats (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  approved   int not null default 0,
  rejected   int not null default 0,
  pending    int not null default 0,
  level      text not null default 'new',  -- cosmetic (new|curator|steward); NEVER gates review
  updated_at timestamptz not null default now()
);

alter table public.contributions     enable row level security;
alter table public.contributor_stats enable row level security;

drop policy if exists contributions_own_select on public.contributions;
create policy contributions_own_select on public.contributions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists contributor_stats_read on public.contributor_stats;
create policy contributor_stats_read on public.contributor_stats
  for select to authenticated using (true);

-- ── Submit a contribution (auth required; queues as pending) ──────────────────
create or replace function public.submit_contribution(
  p_hero_id text, p_kind text, p_target_field text, p_new_value text, p_note text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_id  bigint;
  v_pending int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_kind not in ('field','fact','report') then raise exception 'invalid kind'; end if;
  if not exists (select 1 from public.heroes where id = p_hero_id) then
    raise exception 'unknown hero';
  end if;

  select count(*) into v_pending from public.contributions
    where user_id = v_uid and status = 'pending';
  if v_pending >= 20 then raise exception 'too many pending contributions'; end if;

  if p_kind = 'field' then
    if p_target_field not in
      ('origin','occupation','base','place_of_birth','first_appearance','full_name') then
      raise exception 'field not editable';
    end if;
    if coalesce(btrim(p_new_value), '') = '' then raise exception 'value required'; end if;
    if exists (select 1 from public.contributions
               where user_id = v_uid and hero_id = p_hero_id and kind = 'field'
                 and target_field = p_target_field and status = 'pending') then
      raise exception 'you already have a pending suggestion for this field';
    end if;
    execute format('select %I from public.heroes where id = $1', p_target_field)
      into v_old using p_hero_id;
  elsif p_kind = 'fact' then
    if coalesce(btrim(p_new_value), '') = '' then raise exception 'value required'; end if;
  end if;

  insert into public.contributions (user_id, hero_id, kind, target_field, old_value, new_value, note)
  values (v_uid, p_hero_id, p_kind, p_target_field, v_old, p_new_value, p_note)
  returning id into v_id;

  insert into public.contributor_stats (user_id, pending)
  values (v_uid, 1)
  on conflict (user_id) do update
    set pending = public.contributor_stats.pending + 1, updated_at = now();

  return json_build_object('id', v_id, 'status', 'pending');
end;
$$;

-- ── The caller's own contributions (for the profile "Contributions" section) ──
create or replace function public.get_my_contributions()
returns json language sql security definer set search_path = public stable
as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select c.id, c.hero_id, h.name as hero_name, c.kind, c.target_field,
           c.new_value, c.status, c.reject_reason, c.created_at
    from public.contributions c
    join public.heroes h on h.id = c.hero_id
    where c.user_id = auth.uid()
    order by c.created_at desc
  ) r;
$$;

-- ── Admin: the pending review queue ───────────────────────────────────────────
create or replace function public.admin_review_queue(p_limit int default 50, p_offset int default 0)
returns json language sql security definer set search_path = public stable
as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select c.id, c.hero_id, h.name as hero_name, c.kind, c.target_field,
           c.old_value, c.new_value, c.note, c.created_at, c.user_id,
           p.display_name as submitter
    from public.contributions c
    join public.heroes h on h.id = c.hero_id
    left join public.user_profiles p on p.id = c.user_id
    where c.status = 'pending'
      and exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin)
    order by c.created_at asc
    limit p_limit offset p_offset
  ) r;
$$;

-- ── Admin: approve/reject a contribution (applies the change on approve) ──────
create or replace function public.admin_review_contribution(p_id bigint, p_decision text, p_reason text)
returns json language plpgsql security definer set search_path = public
as $$
declare
  c public.contributions;
  v_admin uuid := auth.uid();
begin
  if not exists (select 1 from public.user_profiles where id = v_admin and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid decision'; end if;

  select * into c from public.contributions where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if c.status <> 'pending' then raise exception 'already reviewed'; end if;

  if p_decision = 'approve' then
    if c.kind = 'field' then
      execute format('update public.heroes set %I = $1 where id = $2', c.target_field)
        using c.new_value, c.hero_id;
    elsif c.kind = 'fact' then
      insert into public.hero_narrative_facts (hero_id, kind, content, source_model, needs_review)
      values (c.hero_id, 'did_you_know', c.new_value, 'community', false);
    end if;  -- 'report' approval = acknowledged, no data mutation
    update public.contributions
      set status = 'approved', reviewed_by = v_admin, reviewed_at = now() where id = p_id;
    update public.contributor_stats
      set approved = approved + 1, pending = greatest(pending - 1, 0), updated_at = now()
      where user_id = c.user_id;
  else
    update public.contributions
      set status = 'rejected', reviewed_by = v_admin, reviewed_at = now(), reject_reason = p_reason
      where id = p_id;
    update public.contributor_stats
      set rejected = rejected + 1, pending = greatest(pending - 1, 0), updated_at = now()
      where user_id = c.user_id;
  end if;

  update public.contributor_stats
    set level = case when approved >= 50 then 'steward'
                     when approved >= 10 then 'curator' else 'new' end
    where user_id = c.user_id;

  return json_build_object('id', p_id,
    'status', case when p_decision = 'approve' then 'approved' else 'rejected' end);
end;
$$;

revoke all on function public.submit_contribution(text, text, text, text, text)   from public, anon;
revoke all on function public.get_my_contributions()                              from public, anon;
revoke all on function public.admin_review_queue(int, int)                        from public, anon;
revoke all on function public.admin_review_contribution(bigint, text, text)       from public, anon;
grant execute on function public.submit_contribution(text, text, text, text, text)  to authenticated, service_role;
grant execute on function public.get_my_contributions()                             to authenticated, service_role;
grant execute on function public.admin_review_queue(int, int)                       to authenticated, service_role;
grant execute on function public.admin_review_contribution(bigint, text, text)      to authenticated, service_role;
