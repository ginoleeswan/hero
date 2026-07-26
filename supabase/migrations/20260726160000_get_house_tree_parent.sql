-- get_house: carry the lineage chain through the re-projection.
--
-- hero_relatives.tree_parent_id points at another hero_relatives ROW, but the
-- house page re-projects the flat graph around whoever is in focus, so those row
-- ids mean nothing on the client — it was dropping them, and every deep forebear
-- fell out of the chart into the "generation unrecorded" list. Resolving the
-- pointer to the parent's HERO id here makes it survive the projection: the
-- client can rebuild the chain from ids it actually holds.
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
