-- Admin direct-set a hero's universe (publisher), used by the "Needs a universe"
-- panel to place Company-Licensed characters inline. Mirrors admin_edit_hero's
-- audit logging; publisher is intentionally not in that RPC's editable list, so
-- this is a dedicated, gated entry point. Caller refreshes fame after (placing a
-- hero into a real franchise makes it fame-eligible).
create or replace function public.admin_set_universe(p_hero_id text, p_publisher text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_old text;
begin
  if not exists (select 1 from public.user_profiles where id = v_admin and is_admin) then
    raise exception 'not authorized';
  end if;
  if coalesce(btrim(p_publisher), '') = '' then raise exception 'universe required'; end if;
  select publisher into v_old from public.heroes where id = p_hero_id;
  if not found then raise exception 'unknown hero'; end if;

  update public.heroes set publisher = btrim(p_publisher) where id = p_hero_id;

  insert into public.contributions
    (user_id, hero_id, kind, target_field, old_value, new_value, status, reviewed_by, reviewed_at)
  values
    (v_admin, p_hero_id, 'field', 'publisher', v_old, btrim(p_publisher), 'approved', v_admin, now());

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.admin_set_universe(text, text) from public, anon;
grant execute on function public.admin_set_universe(text, text) to authenticated;
