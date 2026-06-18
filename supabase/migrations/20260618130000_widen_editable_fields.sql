-- Widen the contributor-editable surface beyond the original 6 text fields.
-- The hero page now exposes inline edit on more sections (Dossier appearance +
-- connections, Summary, Abilities, Power Stats), so the contribution backbone
-- must apply three shapes of value, not just plain text:
--   • text  — a scalar text column (origin, gender, summary, …)
--   • list  — a text[] column (aliases, powers); intake is "one per line"
--   • stat  — an int powerstat 0–100 (intelligence … combat), ADMIN-ONLY
-- Apply logic is centralised in _apply_hero_field so the review-approve path and
-- the admin direct-edit path can never drift. Stats stay admin-only: they feed
-- matchups, so community submissions of them are refused server-side.

-- ── Field classification (single source of truth for the allow-list) ──────────
create or replace function public._contrib_field_type(p_field text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_field in ('aliases','powers') then 'list'
    when p_field in ('intelligence','strength','speed','durability','power','combat') then 'stat'
    when p_field in (
      'origin','full_name','occupation','base','place_of_birth','first_appearance',
      'alter_egos','gender','race','height_imperial','weight_imperial',
      'eye_color','hair_color','group_affiliation','summary','description'
    ) then 'text'
    else null
  end;
$$;

-- Split a "one per line" (or comma-separated) intake into a trimmed text[],
-- dropping blank entries. Newlines are normalised to commas first.
create or replace function public._parse_str_list(p_raw text)
returns text[] language sql immutable set search_path = public as $$
  select array(
    select btrim(x)
    from unnest(string_to_array(replace(p_raw, E'\n', ','), ',')) as x
    where btrim(x) <> ''
  );
$$;

-- Apply one approved/admin field change to a hero, by field type. Centralised so
-- both the review-approve path and admin_edit_hero share identical semantics.
create or replace function public._apply_hero_field(p_hero_id text, p_field text, p_value text)
returns void language plpgsql set search_path = public as $$
declare
  v_type text := public._contrib_field_type(p_field);
begin
  if v_type is null then raise exception 'field not editable'; end if;

  if v_type = 'text' then
    execute format('update public.heroes set %I = $1 where id = $2', p_field)
      using p_value, p_hero_id;

  elsif v_type = 'list' then
    execute format('update public.heroes set %I = $1 where id = $2', p_field)
      using public._parse_str_list(p_value), p_hero_id;

  elsif v_type = 'stat' then
    if p_value !~ '^\d{1,3}$' or p_value::int > 100 then
      raise exception 'stat must be a whole number 0–100';
    end if;
    execute format('update public.heroes set %I = $1 where id = $2', p_field)
      using p_value::int, p_hero_id;
    -- Keep the cached total in step so matchups / percentiles stay correct.
    update public.heroes set powerstats_total =
        coalesce(intelligence,0) + coalesce(strength,0) + coalesce(speed,0)
      + coalesce(durability,0) + coalesce(power,0) + coalesce(combat,0)
      where id = p_hero_id;
  end if;
end;
$$;

-- ── Submit (community): text + list fields only; stats are admin-only ─────────
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
  v_type text;
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
    v_type := public._contrib_field_type(p_target_field);
    if v_type is null then raise exception 'field not editable'; end if;
    if v_type = 'stat' then raise exception 'power stats can only be edited by an admin'; end if;
    if coalesce(btrim(p_new_value), '') = '' then raise exception 'value required'; end if;
    if exists (select 1 from public.contributions
               where user_id = v_uid and hero_id = p_hero_id and kind = 'field'
                 and target_field = p_target_field and status = 'pending') then
      raise exception 'you already have a pending suggestion for this field';
    end if;
    execute format('select %I::text from public.heroes where id = $1', p_target_field)
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

-- ── Admin: approve/reject (applies via the shared helper on approve) ──────────
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
      perform public._apply_hero_field(c.hero_id, c.target_field, c.new_value);
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

-- ── Admin direct-edit: applies immediately; stats permitted here ──────────────
create or replace function public.admin_edit_hero(
  p_hero_id text, p_kind text, p_target_field text, p_new_value text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_old text;
  v_type text;
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
    v_type := public._contrib_field_type(p_target_field);
    if v_type is null then raise exception 'field not editable'; end if;
    execute format('select %I::text from public.heroes where id = $1', p_target_field)
      into v_old using p_hero_id;
    perform public._apply_hero_field(p_hero_id, p_target_field, p_new_value);
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

-- Lock down the new internal helpers (callable only by the definer RPCs).
revoke all on function public._contrib_field_type(text)            from public, anon, authenticated;
revoke all on function public._parse_str_list(text)                from public, anon, authenticated;
revoke all on function public._apply_hero_field(text, text, text)  from public, anon, authenticated;
grant execute on function public._contrib_field_type(text)           to service_role;
grant execute on function public._parse_str_list(text)               to service_role;
grant execute on function public._apply_hero_field(text, text, text) to service_role;

-- Re-assert RPC grants (function bodies were replaced above).
revoke all on function public.submit_contribution(text, text, text, text, text)   from public, anon;
revoke all on function public.admin_review_contribution(bigint, text, text)       from public, anon;
revoke all on function public.admin_edit_hero(text, text, text, text)             from public, anon;
grant execute on function public.submit_contribution(text, text, text, text, text)  to authenticated, service_role;
grant execute on function public.admin_review_contribution(bigint, text, text)      to authenticated, service_role;
grant execute on function public.admin_edit_hero(text, text, text, text)            to authenticated, service_role;
