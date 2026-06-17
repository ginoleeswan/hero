-- Admin direct-edit: a moderator IS the vetting step, so their on-page edits
-- apply immediately (no queue) — but every change is still logged to
-- `contributions` as an auto-approved row (user_id = reviewed_by = the admin),
-- giving one unified per-hero audit trail alongside community edits. Does NOT
-- touch contributor_stats (admin edits aren't community reputation).
create or replace function public.admin_edit_hero(
  p_hero_id text, p_kind text, p_target_field text, p_new_value text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_old text;
begin
  if not exists (select 1 from public.user_profiles where id = v_admin and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_kind not in ('field','fact') then raise exception 'invalid kind'; end if;
  if coalesce(btrim(p_new_value), '') = '' then raise exception 'value required'; end if;
  if not exists (select 1 from public.heroes where id = p_hero_id) then
    raise exception 'unknown hero';
  end if;

  if p_kind = 'field' then
    if p_target_field not in
      ('origin','occupation','base','place_of_birth','first_appearance','full_name') then
      raise exception 'field not editable';
    end if;
    execute format('select %I from public.heroes where id = $1', p_target_field)
      into v_old using p_hero_id;
    execute format('update public.heroes set %I = $1 where id = $2', p_target_field)
      using p_new_value, p_hero_id;
  else
    insert into public.hero_narrative_facts (hero_id, kind, content, source_model, needs_review)
    values (p_hero_id, 'did_you_know', p_new_value, 'admin', false);
  end if;

  insert into public.contributions
    (user_id, hero_id, kind, target_field, old_value, new_value, status, reviewed_by, reviewed_at)
  values
    (v_admin, p_hero_id, p_kind, p_target_field, v_old, p_new_value, 'approved', v_admin, now());

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.admin_edit_hero(text, text, text, text) from public, anon;
grant execute on function public.admin_edit_hero(text, text, text, text) to authenticated, service_role;
