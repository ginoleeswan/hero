-- Iconic rivalries for the explore carousel / rivalries page: distinct unordered
-- pairs from the curated edges, both heroes joined, ranked by combined popularity.
create or replace function public.get_top_rivalries(p_limit integer default 12)
returns table (
  a_id text, a_name text, a_image_url text, a_portrait_url text, a_publisher text,
  b_id text, b_name text, b_image_url text, b_portrait_url text, b_publisher text,
  cross_universe boolean
)
language sql
stable
as $$
  with pairs as (
    select
      least(hero_id, related_id) as x,
      greatest(hero_id, related_id) as y,
      bool_or(cross_universe) as cross_universe
    from public.hero_relationships
    where kind = 'enemy' and source = 'curated'
    group by least(hero_id, related_id), greatest(hero_id, related_id)
  )
  select
    a.id, a.name, a.image_url, a.portrait_url, a.publisher,
    b.id, b.name, b.image_url, b.portrait_url, b.publisher,
    p.cross_universe
  from pairs p
  join public.heroes a on a.id = p.x
  join public.heroes b on b.id = p.y
  order by coalesce(a.issue_count, 0) + coalesce(b.issue_count, 0) desc
  limit p_limit;
$$;

grant execute on function public.get_top_rivalries(integer) to anon, authenticated, service_role;
