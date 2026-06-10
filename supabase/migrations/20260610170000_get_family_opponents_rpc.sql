-- Family members that have their own character page — the picker's "Bloodline"
-- row. Distinct related heroes from the family graph, ranked by popularity.
create or replace function public.get_family_opponents(p_hero_id text, p_limit integer default 24)
returns table (
  id text, name text, image_url text, image_md_url text,
  portrait_url text, publisher text, alignment text
)
language sql
stable
as $$
  select id, name, image_url, image_md_url, portrait_url, publisher, alignment
  from (
    select distinct on (m.id)
      m.id, m.name, m.image_url, m.image_md_url, m.portrait_url,
      m.publisher, m.alignment, m.issue_count
    from public.hero_relatives hr
    join public.heroes m on m.id = hr.related_hero_id and m.id <> p_hero_id
    where hr.hero_id = p_hero_id and hr.related_hero_id is not null
    order by m.id
  ) x
  order by x.issue_count desc nulls last
  limit p_limit;
$$;

grant execute on function public.get_family_opponents(text, integer) to anon, authenticated, service_role;
