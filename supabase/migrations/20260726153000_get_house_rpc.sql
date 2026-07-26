-- One call returns everything the house page needs: meta, member rows, and the
-- edges among those members.
--
-- The whole Westeros graph is ~110 nodes and 1,666 edges, about 40KB, so it
-- ships once and every later interaction -- re-root, pathfind, hover -- is
-- local. That is what lets the pathfinder answer in a frame instead of a round
-- trip, and it matters more than it looks: anon has a 3s statement timeout, so
-- a per-query round trip would be the thing that breaks first under load.
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
           h.summary, h.portrait_blurhash, m.via
    from public.house_members m
    join public.heroes h on h.id = m.hero_id
    where m.house_slug = p_slug
  ),
  edg as (
    -- Only edges whose BOTH ends are in the house; a link to someone outside it
    -- has nothing to draw to.
    select r.hero_id, r.related_hero_id, r.relation::text as relation, r.role,
           r.tier, r.branch_side, r.tree_parent_id, r.position, r.modifiers, r.status
    from public.hero_relatives r
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

create index if not exists hero_relatives_related_idx
  on public.hero_relatives(related_hero_id) where related_hero_id is not null;
