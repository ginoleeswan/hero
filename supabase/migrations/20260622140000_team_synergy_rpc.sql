-- Transparent synergy for ANY roster (curated or drafted). Three components,
-- each a bounded fraction; the breakdown doubles as the UI explanation.
-- Weights are named constants here so they tune in one place.
create or replace function public.get_team_synergy(p_hero_ids text[])
returns json language plpgsql stable security definer
set search_path = public
as $$
declare
  W_LINKS constant numeric := 0.12;  -- full teammate-link weight
  W_AFFIL constant numeric := 0.06;  -- full shared-affiliation weight
  W_ROLE  constant numeric := 0.04;  -- full role-balance weight
  CAP     constant numeric := 0.25;
  n              int;
  max_pairs      int;
  link_count     int := 0;
  links_pct      numeric := 0;
  affil_team     text := null;
  affil_coverage int := 0;
  affil_pct      numeric := 0;
  archetypes     int := 0;
  role_pct       numeric := 0;
  total          numeric := 0;
begin
  n := coalesce(array_length(p_hero_ids, 1), 0);
  if n < 2 then
    return json_build_object(
      'teammate_links', json_build_object('count', 0, 'max', 0, 'pct', 0),
      'shared_affiliation', json_build_object('team', null, 'coverage', 0, 'pct', 0),
      'role_balance', json_build_object('archetypes', case when n = 1 then 1 else 0 end, 'pct', 0),
      'total_pct', 0
    );
  end if;
  max_pairs := n * (n - 1) / 2;

  -- teammate links: distinct unordered pairs in the set with a teammate edge.
  select count(*) into link_count
  from (
    select distinct least(r.hero_id, r.related_id) a, greatest(r.hero_id, r.related_id) b
    from public.hero_relationships r
    where r.kind = 'teammate'
      and r.hero_id = any(p_hero_ids)
      and r.related_id = any(p_hero_ids)
  ) pairs;
  links_pct := W_LINKS * (link_count::numeric / max_pairs);

  -- shared affiliation: the team in heroes.teams[] covering the most members.
  select trim(t), count(*) into affil_team, affil_coverage
  from public.heroes h
  cross join lateral unnest(h.teams) as t
  where h.id = any(p_hero_ids) and length(trim(t)) > 1
  group by trim(t)
  order by count(*) desc
  limit 1;
  affil_coverage := coalesce(affil_coverage, 0);
  affil_pct := case when affil_coverage >= 2 then W_AFFIL * (affil_coverage::numeric / n) else 0 end;

  -- role balance: distinct dominant-stat archetypes across the roster.
  select count(distinct dom) into archetypes
  from (
    select (select k from (values
      ('intelligence', h.intelligence),('strength', h.strength),('speed', h.speed),
      ('durability', h.durability),('power', h.power),('combat', h.combat)
    ) as s(k, v) order by v desc nulls last limit 1) as dom
    from public.heroes h where h.id = any(p_hero_ids)
  ) doms;
  role_pct := W_ROLE * (archetypes::numeric / n);

  total := least(CAP, links_pct + affil_pct + role_pct);

  return json_build_object(
    'teammate_links', json_build_object('count', link_count, 'max', max_pairs, 'pct', round(links_pct, 4)),
    'shared_affiliation', json_build_object('team', affil_team, 'coverage', affil_coverage, 'pct', round(affil_pct, 4)),
    'role_balance', json_build_object('archetypes', archetypes, 'pct', round(role_pct, 4)),
    'total_pct', round(total, 4)
  );
end;
$$;

revoke all on function public.get_team_synergy(text[]) from public;
grant execute on function public.get_team_synergy(text[]) to anon, authenticated, service_role;
