-- User-facing reports (moderation). Signed-in only; the RPC is the sole insert
-- path (no direct client insert), mirroring contributions/submit_contribution.
-- Reports never mutate the hero — resolving is an acknowledgement, remediation
-- is a separate deliberate admin action.

create table if not exists public.reports (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  hero_id         text not null references public.heroes(id) on delete cascade,
  target_type     text not null,                 -- 'page' | 'image' | 'ai_portrait'
  image_url       text,                          -- reported image; null for 'page'
  reason          text not null,                 -- category code (guarded below)
  detail          text,                          -- free-text note
  status          text not null default 'open',  -- 'open' | 'resolved' | 'dismissed'
  resolved_by     uuid references auth.users(id),
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  constraint reports_target_chk check (target_type in ('page','image','ai_portrait')),
  constraint reports_status_chk check (status in ('open','resolved','dismissed'))
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_hero_idx   on public.reports (hero_id);

alter table public.reports enable row level security;

-- Own-select only (so a "you reported this" state is possible later). No insert
-- policy: inserts flow exclusively through submit_report (SECURITY DEFINER).
drop policy if exists reports_own_select on public.reports;
create policy reports_own_select on public.reports
  for select to authenticated using (user_id = auth.uid());

-- Reason must be valid FOR the target_type. One home for the allow-list, shared
-- by submit_report; keep in sync with REPORT_REASONS in src/lib/db/reports.ts.
create or replace function public._report_reason_ok(p_target text, p_reason text)
returns boolean language sql immutable as $$
  select case p_target
    when 'page'        then p_reason in ('inaccurate','offensive','duplicate','spam','other')
    when 'image'       then p_reason in ('wrong_subject','offensive','low_quality','other')
    when 'ai_portrait' then p_reason in ('ai_inaccurate','offensive','low_quality','other')
    else false end;
$$;

-- ── Submit a report (auth required; the ONLY insert path) ─────────────────────
create or replace function public.submit_report(
  p_hero_id text, p_target_type text, p_image_url text, p_reason text, p_detail text
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
  if p_target_type not in ('page','image','ai_portrait') then raise exception 'invalid target'; end if;
  if not public._report_reason_ok(p_target_type, p_reason) then raise exception 'invalid reason'; end if;
  if not exists (select 1 from public.heroes where id = p_hero_id) then raise exception 'unknown hero'; end if;
  if p_target_type = 'page' then
    v_img := null;                                   -- page reports carry no image
  elsif v_img is null then
    raise exception 'image required';                -- image/ai reports must reference one
  end if;
  if p_reason = 'other' and v_detail is null then raise exception 'detail required'; end if;
  v_detail := left(v_detail, 1000);

  select count(*) into v_open from public.reports
    where user_id = v_uid and status = 'open';
  if v_open >= 30 then raise exception 'too many open reports'; end if;

  -- One open report per (user, hero, target, image).
  if exists (
    select 1 from public.reports
    where user_id = v_uid and hero_id = p_hero_id and status = 'open'
      and target_type = p_target_type and coalesce(image_url,'') = coalesce(v_img,'')
  ) then raise exception 'already reported'; end if;

  insert into public.reports (user_id, hero_id, target_type, image_url, reason, detail)
  values (v_uid, p_hero_id, p_target_type, v_img, p_reason, v_detail)
  returning id into v_id;

  return json_build_object('id', v_id, 'status', 'open');
end;
$$;

-- ── Admin: the reports queue ──────────────────────────────────────────────────
create or replace function public.admin_reports_queue(
  p_status text default 'open', p_reason text default null, p_limit int default 100, p_offset int default 0
) returns json language sql security definer set search_path = public stable
as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select rp.id, rp.hero_id, h.name as hero_name, h.portrait_url as hero_portrait_url,
           rp.target_type, rp.image_url, rp.reason, rp.detail, rp.status,
           rp.resolution_note, rp.created_at, rp.user_id,
           up.display_name as submitter
    from public.reports rp
    join public.heroes h on h.id = rp.hero_id
    left join public.user_profiles up on up.id = rp.user_id
    where rp.status = p_status
      and (p_reason is null or rp.reason = p_reason)
      and exists (select 1 from public.user_profiles a where a.id = auth.uid() and a.is_admin)
    order by rp.created_at desc
    limit p_limit offset p_offset
  ) r;
$$;

-- ── Admin: resolve / dismiss a report (no hero/image mutation) ────────────────
create or replace function public.admin_resolve_report(p_id bigint, p_decision text, p_note text)
returns json language plpgsql security definer set search_path = public
as $$
declare v_admin uuid := auth.uid();
begin
  if not exists (select 1 from public.user_profiles where id = v_admin and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_decision not in ('resolve','dismiss') then raise exception 'invalid decision'; end if;

  update public.reports
    set status = case when p_decision = 'resolve' then 'resolved' else 'dismissed' end,
        resolved_by = v_admin, resolved_at = now(),
        resolution_note = nullif(btrim(coalesce(p_note,'')), '')
    where id = p_id and status = 'open';
  if not found then raise exception 'not found or already reviewed'; end if;

  return json_build_object('id', p_id,
    'status', case when p_decision = 'resolve' then 'resolved' else 'dismissed' end);
end;
$$;

revoke all on function public.submit_report(text, text, text, text, text)        from public, anon;
revoke all on function public.admin_reports_queue(text, text, int, int)          from public, anon;
revoke all on function public.admin_resolve_report(bigint, text, text)           from public, anon;
grant execute on function public.submit_report(text, text, text, text, text)       to authenticated, service_role;
grant execute on function public.admin_reports_queue(text, text, int, int)         to authenticated, service_role;
grant execute on function public.admin_resolve_report(bigint, text, text)          to authenticated, service_role;
