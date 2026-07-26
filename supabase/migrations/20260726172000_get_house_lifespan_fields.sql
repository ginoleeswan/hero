-- get_house: carry born/died/reign through to the house page, so a node click
-- can say when someone lived and how long they ruled.
create or replace function public.get_house(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with ho as (
    select * from public.houses where slug = p_slug
  ),
  mem as (
    select h.id, h.name, h.portrait_url, h.avatar_url, h.image_url, h.image_md_url,
           h.alignment, h.gender, h.fame_score, h.publisher, h.franchise,
           h.summary, h.portrait_blurhash,
           h.born, h.died, h.reign_start, h.reign_end,
           m.via
    from public.house_members m
    join public.heroes h on h.id = m.hero_id
    where m.house_slug = p_slug
  ),
  edg as (
    select r.hero_id, r.related_hero_id, r.relation::text as relation, r.role,
           r.tier, r.branch_side, r.position, r.modifiers, r.status,
           p.related_hero_id as tree_parent_hero_id
    from public.hero_relatives r
    left join public.hero_relatives p
      on p.id = r.tree_parent_id and p.hero_id = r.hero_id
    where r.related_hero_id is not null
      and exists (select 1 from mem a where a.id = r.hero_id)
      and exists (select 1 from mem b where b.id = r.related_hero_id)
  )
  select jsonb_build_object(
    'house',   (select to_jsonb(ho) from ho),
    'members', coalesce((select jsonb_agg(to_jsonb(mem) order by mem.fame_score desc nulls last) from mem), '[]'::jsonb),
    'edges',   coalesce((select jsonb_agg(to_jsonb(edg)) from edg), '[]'::jsonb)
  )
  where exists (select 1 from ho);
$$;

grant execute on function public.get_house(text) to anon, authenticated;
