-- Reverse-lookup leaderboard: the villains the most distinct heroes count as an
-- enemy (enemy in-degree) — the explore "Most Feared" / Hall of Infamy ranking.
create or replace function public.get_most_feared(p_limit integer default 12)
returns table (
  id text, name text, image_url text, image_md_url text,
  portrait_url text, publisher text, alignment text, feared_by integer
)
language sql
stable
as $$
  select m.id, m.name, m.image_url, m.image_md_url, m.portrait_url,
         m.publisher, m.alignment, count(distinct r.hero_id)::integer as feared_by
  from public.hero_relationships r
  join public.heroes m on m.id = r.related_id
  where r.kind = 'enemy' and m.alignment in ('bad', 'neutral')
  group by m.id, m.name, m.image_url, m.image_md_url, m.portrait_url, m.publisher, m.alignment
  order by count(distinct r.hero_id) desc, m.issue_count desc nulls last
  limit p_limit;
$$;

grant execute on function public.get_most_feared(integer) to anon, authenticated, service_role;
