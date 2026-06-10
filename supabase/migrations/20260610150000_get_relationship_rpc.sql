-- Relationship between two specific heroes, across both graphs (associations +
-- family). Powers the relationship-aware arena badge + verdict context.
create or replace function public.get_relationship(p_a text, p_b text)
returns table (
  is_enemy boolean,
  is_ally boolean,
  is_teammate boolean,
  is_curated boolean,
  cross_universe boolean,
  family_relation text
)
language sql
stable
as $$
  select
    coalesce(bool_or(r.kind = 'enemy'), false),
    coalesce(bool_or(r.kind = 'ally'), false),
    coalesce(bool_or(r.kind = 'teammate'), false),
    coalesce(bool_or(r.kind = 'enemy' and r.source = 'curated'), false),
    coalesce(bool_or(r.cross_universe), false),
    (
      select hr.relation::text
      from public.hero_relatives hr
      where (hr.hero_id = p_a and hr.related_hero_id = p_b)
         or (hr.hero_id = p_b and hr.related_hero_id = p_a)
      order by hr.tier <> 0
      limit 1
    )
  from public.hero_relationships r
  where (r.hero_id = p_a and r.related_id = p_b)
     or (r.hero_id = p_b and r.related_id = p_a);
$$;

grant execute on function public.get_relationship(text, text) to anon, authenticated, service_role;
