-- Take moderation: close the loop the takes backbone opened.
-- Final-review follow-up for 20260712120000_matchup_takes_daily_debate:
-- * admin_reports_queue now surfaces take_id + the offending take's body, so
--   the Reports lane can show what was reported.
-- * set_take_status gives admins a takedown lever (hidden/removed) — until
--   now nothing could ever set a non-visible status, making take reports
--   unactionable without hand-written SQL.

create or replace function public.admin_reports_queue(
  p_status text default 'open', p_reason text default null, p_limit int default 100, p_offset int default 0
) returns json language sql security definer set search_path = public stable
as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select rp.id, rp.hero_id, h.name as hero_name, h.portrait_url as hero_portrait_url,
           rp.target_type, rp.image_url, rp.reason, rp.detail, rp.status,
           rp.resolution_note, rp.created_at, rp.user_id,
           up.display_name as submitter,
           rp.take_id, t.body as take_body, t.status as take_status
    from public.reports rp
    join public.heroes h on h.id = rp.hero_id
    left join public.user_profiles up on up.id = rp.user_id
    left join public.matchup_takes t on t.id = rp.take_id
    where rp.status = p_status
      and (p_reason is null or rp.reason = p_reason)
      and exists (select 1 from public.user_profiles a where a.id = auth.uid() and a.is_admin)
    order by rp.created_at desc
    limit p_limit offset p_offset
  ) r;
$$;

-- Admin takedown / restore. Same inline gate the other admin RPCs use.
create or replace function public.set_take_status(p_take_id uuid, p_status text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_profiles
                 where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_status not in ('visible', 'hidden', 'removed') then
    raise exception 'invalid status';
  end if;
  update public.matchup_takes set status = p_status where id = p_take_id;
  if not found then raise exception 'take not found'; end if;
  return json_build_object('id', p_take_id, 'status', p_status);
end;
$$;

revoke all on function public.set_take_status(uuid, text) from public, anon;
grant execute on function public.set_take_status(uuid, text) to authenticated, service_role;
