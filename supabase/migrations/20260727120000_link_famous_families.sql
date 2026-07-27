-- Four famous families that were already recorded and simply never linked.
--
-- Every relation below was ALREADY in `hero_relatives` as free text; what was
-- missing was `related_hero_id`, so the graph could not see it. This resolves
-- the catalogue's own records rather than asserting anything new, which is why
-- each update is pinned to one row id and one hero id.
--
-- The Skywalker one is a typo. Luke's sibling row reads "Princes Leia" — one s
-- short — which is the entire reason the most famous brother and sister in
-- cinema were not connected to each other.
--
-- What is deliberately NOT linked, because the catalogue has no row for them:
-- Corsair (Christopher Summers), Shmi Skywalker, Anakin as distinct from Darth
-- Vader, and Thor's Norse forebears (Buri, Bor, Bestla, Bolthorn, Vili, Ve).
-- They stay as text, which is honest — the record names them without holding
-- them.

-- Skywalker.
update hero_relatives set related_hero_id = 'cv-33545', name = 'Princess Leia'
where id = 'f849dbdb-285f-49e1-9e29-344dd3195bb2' and related_hero_id is null;

-- Asgard. Frigga is filed under "In the Public Domain" — the Norse goddess is,
-- but this row is Marvel's, and it blocks every franchise-scoped query.
update heroes set publisher = 'Marvel' where id = 'h_d91afb39-6b0b-4be7-a8a7-69691d50a73e';
update hero_relatives set related_hero_id = 'h_d91afb39-6b0b-4be7-a8a7-69691d50a73e'
where id = 'c01fdb8b-79b6-4011-9172-99ee74eda428' and related_hero_id is null;

-- Summers. The tangle is fully written down and almost none of it was wired up:
-- two brothers, two wives, a son and an uncle.
update hero_relatives set related_hero_id = 'cv-3546'
where id = '9ebdc77f-914b-475a-a779-975ee2415148' and related_hero_id is null;   -- Havok
update hero_relatives set related_hero_id = 'cv-21233'
where id = 'c2040323-1e9b-437d-95ff-2ed15e8a23b4' and related_hero_id is null;   -- Vulcan
update hero_relatives set related_hero_id = 'cv-3552'
where id = 'c68aab30-29c4-4c19-b5c1-eca8460fc942' and related_hero_id is null;   -- Jean Grey
update hero_relatives set related_hero_id = 'cv-10981'
where id = '68858e99-7fdb-4f28-909e-9c23831ef7e6' and related_hero_id is null;   -- Madelyne Pryor
update hero_relatives set related_hero_id = '145'
where id = '1df653b7-b900-420c-b02a-4dcd65d4d3c7' and related_hero_id is null;   -- Cable
update hero_relatives set related_hero_id = 'cv-21233'
where id = 'ff5c20a5-bfdb-4e0d-a2ed-b6b371436988' and related_hero_id is null;   -- Cable's uncle Vulcan

-- Themyscira.
update hero_relatives set related_hero_id = 'cv-4929'
where id = '4e557590-0aa1-4ecc-9581-9005655ab4a0' and related_hero_id is null;   -- Hippolyta

-- Reciprocals, so these people have a tree of their own and not just a place in
-- someone else's. Each is the inverse of an edge recorded above or already in
-- the table — Vader records Leia as his daughter, Kylo records her as his
-- mother — and nothing here is a relation the catalogue doesn't already assert.
insert into hero_relatives (hero_id, name, relation, role, tier, related_hero_id, position)
select v.hero_id, v.nm, v.rel::relation_kind, v.role, v.tier, v.rid,
       coalesce((select max(position) + 1 from hero_relatives x where x.hero_id = v.hero_id), 0)
from (values
  -- Leia: father, twin, husband, son.
  ('cv-33545', 'Darth Vader',    'parent',  'father',   1,  '208'),
  ('cv-33545', 'Luke Skywalker', 'sibling', 'brother',  0,  '418'),
  ('cv-33545', 'Han Solo',       'spouse',  'husband',  0,  'cv-2608'),
  ('cv-33545', 'Kylo Ren',       'child',   'son',     -1,  '398'),
  -- Han: wife and son.
  ('cv-2608',  'Princess Leia',  'spouse',  'wife',     0,  'cv-33545'),
  ('cv-2608',  'Kylo Ren',       'child',   'son',     -1,  '398'),
  -- Odin: two sons and a wife.
  ('cv-3507',  'Thor',           'child',   'son',     -1,  '659'),
  ('cv-3507',  'Loki',           'child',   'adopted son', -1, 'cv-4324'),
  ('cv-3507',  'Frigga',         'spouse',  'wife',     0,  'h_d91afb39-6b0b-4be7-a8a7-69691d50a73e'),
  -- Loki: father, brother, daughter.
  ('cv-4324',  'Odin',           'parent',  'adoptive father', 1, 'cv-3507'),
  ('cv-4324',  'Thor',           'sibling', 'adoptive brother', 0, '659'),
  ('cv-4324',  'Hela',           'child',   'daughter', -1, '321')
) as v(hero_id, nm, rel, role, tier, rid)
where not exists (
  select 1 from hero_relatives e where e.hero_id = v.hero_id and e.related_hero_id = v.rid
);
