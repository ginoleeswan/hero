-- Two passes.
--
-- 1. Surname seed: everyone in the universe whose name ends with the house name.
-- 2. One hop of closure along lineal and spouse edges.
--
-- One hop is the bound that matters. It picks up Jon Snow as both a Stark and a
-- Targaryen -- correct, and the most interesting fact in the set -- and
-- married-in members like Catelyn Stark, while stopping well short of the whole
-- 83-node component. Measured before applying: Targaryen 38+17, Baratheon 10+20,
-- Stark 11+4, Tully 3+8, Lannister 7+4, Martell 2+1, Greyjoy 6+0, Tyrell 6+0.
--
-- Connected components were rejected as a definition of a house: Targaryen,
-- Stark, Baratheon and Lannister are interlinked by marriage, so clustering the
-- graph yields "Westeros", not houses.
with seeds as (
  select ho.slug, h.id
  from public.houses ho
  join public.heroes h
    on h.publisher = ho.universe
   and h.name ilike '% ' || initcap(ho.slug)
),
und as (
  select r.hero_id a, r.related_hero_id b, r.relation
    from public.hero_relatives r where r.related_hero_id is not null
  union
  select r.related_hero_id, r.hero_id, r.relation
    from public.hero_relatives r where r.related_hero_id is not null
),
kin as (
  select distinct s.slug, u.b as id
  from seeds s
  join und u on u.a = s.id
  where u.relation in
    ('parent','child','grandparent','grandchild','ancestor','descendant','sibling','spouse')
)
insert into public.house_members (house_slug, hero_id, via)
select slug, id, 'surname' from seeds
union all
select k.slug, k.id, 'kin'
from kin k
where not exists (select 1 from seeds s where s.slug = k.slug and s.id = k.id)
on conflict (house_slug, hero_id) do nothing;
