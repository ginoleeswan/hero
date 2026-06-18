-- Fix: heroes.powerstats_total is a GENERATED ALWAYS column (sum of the six
-- powerstats), so the stat-apply path in _apply_hero_field must NOT write to it
-- directly — Postgres rejects updates to generated columns, which would make
-- every admin power-stat edit throw. Updating the underlying stat column
-- recomputes the total automatically, so we simply drop the manual update.
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
    -- powerstats_total recomputes itself (GENERATED ALWAYS) — no manual update.
  end if;
end;
$$;

revoke all on function public._apply_hero_field(text, text, text) from public, anon, authenticated;
grant execute on function public._apply_hero_field(text, text, text) to service_role;
