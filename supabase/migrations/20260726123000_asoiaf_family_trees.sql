-- Family trees for the great houses of Westeros.
--
-- Game of Thrones is the best family-tree showcase in the catalogue: the
-- genealogy IS the plot. Before this migration the universe had zero rows in
-- hero_relatives, so every one of these characters showed an empty tree.
--
-- Why this is authored as derivation rather than 300 hand-written rows: a family
-- tree is symmetric and transitive. Writing "Ned is Arya's father" by hand means
-- also remembering "Arya is Ned's daughter", "Arya and Sansa are sisters",
-- "Ned is Jon's uncle", "Robb is Jon's cousin" — hundreds of rows that drift out
-- of sync the moment one is edited. So the migration states only the primitive
-- facts (who fathered whom, who married whom, who is a sibling where the parent
-- is not in the catalogue) and derives the other nine relation types from them.
--
-- Every relative here resolves to a real hero row, so related_hero_id is set
-- directly rather than left to the name-matching linker — the trees render with
-- portraits, power badges and working links from the first load.
--
-- The one editorial decision: Jon Snow is modelled with his true parents,
-- Rhaegar Targaryen and Lyanna Stark. This is canon by the end of the series and
-- it is what makes the tree worth looking at — it is the single edge that joins
-- House Stark to House Targaryen, making Daenerys his aunt and Robb, Sansa,
-- Arya, Bran and Rickon his cousins. Modelling him as Ned's bastard would leave
-- two disconnected trees and be wrong besides.

-- ── 0. Two stragglers needed by the Tyrell and Mormont trees ─────────────
-- Both have ComicVine ids inside the ASOIAF blocks (177031 sits between Ygritte
-- 177029 and Osney Kettleblack 177030; 154252 is in the Clash of Kings run) but
-- no first_issue_data, so the reclaim migration's series filter missed them.
update public.heroes
set publisher = 'Game of Thrones',
    franchise = 'A Song of Ice and Fire'
where publisher is null
  and (id, name, comicvine_id) in (
    ('h_1659bc52-59df-486c-8985-e202c0e046f9', 'Mace Tyrell',       '177031'),
    ('h_3227eafa-1dc6-4f14-bf2e-8f26a5f6e87b', 'Lynesse Hightower', '154252')
  );

-- ── 1. Gender, which the role labels are computed from ───────────────────
-- Only 29 of 298 rows carried a gender; without it every tree node would read
-- "parent" instead of "father"/"mother".
update public.heroes h
set gender = v.gender
from (values
  ('Rickard Stark','Male'),('Eddard Stark','Male'),('Catelyn Stark','Female'),
  ('Brandon Stark','Male'),('Lyanna Stark','Female'),('Benjen Stark','Male'),
  ('Robb Stark','Male'),('Sansa Stark','Female'),('Arya Stark','Female'),
  ('Bran Stark','Male'),('Rickon Stark','Male'),('Jon Snow','Male'),
  ('Hoster Tully','Male'),('Brynden Tully','Male'),('Edmure Tully','Male'),
  ('Lysa Arryn','Female'),('John Arryn','Male'),('Robert Arryn','Male'),
  ('Tywin Lannister','Male'),('Kevan Lannister','Male'),('Cersei Lannister','Female'),
  ('Jaime Lannister','Male'),('Tyrion Lannister','Male'),('Lancel Lannister','Male'),
  ('Robert Baratheon','Male'),('Stannis Baratheon','Male'),('Renly Baratheon','Male'),
  ('Selyse Baratheon','Female'),('Shireen Baratheon','Female'),('Joffrey Baratheon','Male'),
  ('Myrcella Baratheon','Female'),('Tommen Baratheon','Male'),('Gendry','Male'),('Barra','Female'),
  ('Aerys Targaryen','Male'),('Rhaegar Targaryen','Male'),('Viserys Targaryen','Male'),
  ('Daenerys Targaryen','Female'),('Elia Martell','Female'),('Khal Drogo','Male'),
  ('Balon Greyjoy','Male'),('Euron Greyjoy','Male'),('Victarion Greyjoy','Male'),
  ('Aeron Greyjoy','Male'),('Theon Greyjoy','Male'),('Asha Greyjoy','Female'),
  ('Olenna Tyrell','Female'),('Mace Tyrell','Male'),('Margaery Tyrell','Female'),
  ('Loras Tyrell','Male'),('Garlan Tyrell','Male'),
  ('Oberyn Martell','Male'),('Ellaria Sand','Female'),
  ('Roose Bolton','Male'),('Ramsay Bolton','Male'),
  ('Gregor Clegane','Male'),('Sandor Clegane','Male'),
  ('Jeor Mormont','Male'),('Jorah Mormont','Male'),('Maege Mormont','Female'),
  ('Lyanna Mormont','Female'),('Lynesse Hightower','Female'),
  ('Randyll Tarly','Male'),('Samwell Tarly','Male'),('Dickon Tarly','Male'),('Melessa Tarly','Female'),
  ('Walder Frey','Male'),('Stevron Frey','Male'),('Joyeuse Frey','Female'),
  ('Viserys I Targaryen','Male'),('Daemon Targaryen','Male'),('Rhaenyra Targaryen','Female'),
  ('Alicent Hightower','Female'),('Otto Hightower','Male'),('Aegon II Targaryen','Male'),
  ('Helaena Targaryen','Female'),('Aemond Targaryen','Male'),('Rhaenys Targaryen','Female'),
  ('Corlys Velaryon','Male')
) as v(name, gender)
where h.name = v.name and h.publisher = 'Game of Thrones' and h.gender is null;

-- ── 2. Derive the trees ──────────────────────────────────────────────────
with
-- Primitive fact 1: parentage.
par(parent, child) as (values
  -- House Stark
  ('Rickard Stark','Brandon Stark'),('Rickard Stark','Eddard Stark'),
  ('Rickard Stark','Lyanna Stark'),('Rickard Stark','Benjen Stark'),
  ('Eddard Stark','Robb Stark'),('Eddard Stark','Sansa Stark'),('Eddard Stark','Arya Stark'),
  ('Eddard Stark','Bran Stark'),('Eddard Stark','Rickon Stark'),
  ('Catelyn Stark','Robb Stark'),('Catelyn Stark','Sansa Stark'),('Catelyn Stark','Arya Stark'),
  ('Catelyn Stark','Bran Stark'),('Catelyn Stark','Rickon Stark'),
  -- The edge that joins Stark to Targaryen
  ('Rhaegar Targaryen','Jon Snow'),('Lyanna Stark','Jon Snow'),
  -- House Tully / Arryn
  ('Hoster Tully','Catelyn Stark'),('Hoster Tully','Lysa Arryn'),('Hoster Tully','Edmure Tully'),
  ('Lysa Arryn','Robert Arryn'),('John Arryn','Robert Arryn'),
  -- House Lannister. Joffrey, Myrcella and Tommen are Jaime's, not Robert's.
  ('Tywin Lannister','Cersei Lannister'),('Tywin Lannister','Jaime Lannister'),
  ('Tywin Lannister','Tyrion Lannister'),('Kevan Lannister','Lancel Lannister'),
  ('Jaime Lannister','Joffrey Baratheon'),('Jaime Lannister','Myrcella Baratheon'),
  ('Jaime Lannister','Tommen Baratheon'),
  ('Cersei Lannister','Joffrey Baratheon'),('Cersei Lannister','Myrcella Baratheon'),
  ('Cersei Lannister','Tommen Baratheon'),
  -- House Baratheon
  ('Robert Baratheon','Gendry'),('Robert Baratheon','Barra'),
  ('Stannis Baratheon','Shireen Baratheon'),('Selyse Baratheon','Shireen Baratheon'),
  -- House Targaryen
  ('Aerys Targaryen','Rhaegar Targaryen'),('Aerys Targaryen','Viserys Targaryen'),
  ('Aerys Targaryen','Daenerys Targaryen'),
  -- House Greyjoy
  ('Balon Greyjoy','Theon Greyjoy'),('Balon Greyjoy','Asha Greyjoy'),
  -- House Tyrell
  ('Olenna Tyrell','Mace Tyrell'),('Mace Tyrell','Margaery Tyrell'),
  ('Mace Tyrell','Loras Tyrell'),('Mace Tyrell','Garlan Tyrell'),
  -- Bolton, Mormont, Tarly, Frey
  ('Roose Bolton','Ramsay Bolton'),
  ('Jeor Mormont','Jorah Mormont'),('Maege Mormont','Lyanna Mormont'),
  ('Randyll Tarly','Samwell Tarly'),('Randyll Tarly','Dickon Tarly'),
  ('Melessa Tarly','Samwell Tarly'),('Melessa Tarly','Dickon Tarly'),
  ('Walder Frey','Stevron Frey'),
  -- The Dance of the Dragons
  ('Viserys I Targaryen','Rhaenyra Targaryen'),('Viserys I Targaryen','Aegon II Targaryen'),
  ('Viserys I Targaryen','Helaena Targaryen'),('Viserys I Targaryen','Aemond Targaryen'),
  ('Alicent Hightower','Aegon II Targaryen'),('Alicent Hightower','Helaena Targaryen'),
  ('Alicent Hightower','Aemond Targaryen'),
  ('Otto Hightower','Alicent Hightower')
),
-- Primitive fact 2: marriages.
mar(a, b) as (values
  ('Eddard Stark','Catelyn Stark'),
  ('Robert Baratheon','Cersei Lannister'),
  ('Stannis Baratheon','Selyse Baratheon'),
  ('Daenerys Targaryen','Khal Drogo'),
  ('Lysa Arryn','John Arryn'),
  ('Jorah Mormont','Lynesse Hightower'),
  ('Randyll Tarly','Melessa Tarly'),
  ('Walder Frey','Joyeuse Frey'),
  ('Rhaegar Targaryen','Elia Martell'),
  ('Viserys I Targaryen','Alicent Hightower'),
  ('Daemon Targaryen','Rhaenyra Targaryen'),
  ('Aegon II Targaryen','Helaena Targaryen'),
  ('Corlys Velaryon','Rhaenys Targaryen')
),
-- Primitive fact 3: siblings whose shared parent is not in the catalogue, so
-- they cannot be derived from `par`.
sib_x(a, b) as (values
  ('Robert Baratheon','Stannis Baratheon'),('Robert Baratheon','Renly Baratheon'),
  ('Stannis Baratheon','Renly Baratheon'),
  ('Tywin Lannister','Kevan Lannister'),
  ('Hoster Tully','Brynden Tully'),
  ('Balon Greyjoy','Euron Greyjoy'),('Balon Greyjoy','Victarion Greyjoy'),
  ('Balon Greyjoy','Aeron Greyjoy'),('Euron Greyjoy','Victarion Greyjoy'),
  ('Euron Greyjoy','Aeron Greyjoy'),('Victarion Greyjoy','Aeron Greyjoy'),
  ('Gregor Clegane','Sandor Clegane'),
  ('Oberyn Martell','Elia Martell'),
  ('Jeor Mormont','Maege Mormont'),
  ('Viserys I Targaryen','Daemon Targaryen')
),
-- Half-siblings: share one parent only. Derivation cannot tell these apart
-- because the missing parent simply is not modelled.
half(a, b) as (values
  ('Rhaenyra Targaryen','Aegon II Targaryen'),
  ('Rhaenyra Targaryen','Helaena Targaryen'),
  ('Rhaenyra Targaryen','Aemond Targaryen'),
  ('Gendry','Barra')
),
-- Resolve every name to a real hero row. Anything unresolved drops out here
-- rather than becoming a dangling text-only node.
person as (
  select id, name, gender from public.heroes where publisher = 'Game of Thrones'
),
-- Symmetric sibling set: shared parent, plus the explicit pairs, both ways.
sib as (
  select distinct a, b from (
    select p1.child as a, p2.child as b
    from par p1 join par p2 on p1.parent = p2.parent and p1.child <> p2.child
    union all select a, b from sib_x
    union all select b, a from sib_x
  ) s
),
-- Every derived relationship, as (subject, other, relation, tier, branch_side).
edges as (
  -- parent / child
  select c.child as subj, c.parent as other, 'parent'::text as rel, 1 as tier,
         case when pp.gender = 'Female' then 'maternal' else 'paternal' end as side
  from par c join person pp on pp.name = c.parent
  union all
  select c.parent, c.child, 'child', -1, null from par c
  -- siblings
  union all
  select a, b, 'sibling', 0, null from sib
  -- spouses, both directions
  union all
  select a, b, 'spouse', 0, 'spouse' from mar
  union all
  select b, a, 'spouse', 0, 'spouse' from mar
  -- grandparent / grandchild
  union all
  select gc.child, gp.parent, 'grandparent', 2,
         case when mid.gender = 'Female' then 'maternal' else 'paternal' end
  from par gp join par gc on gc.parent = gp.child
  join person mid on mid.name = gp.child
  union all
  select gp.parent, gc.child, 'grandchild', -2, null
  from par gp join par gc on gc.parent = gp.child
  -- aunt / uncle and niece / nephew
  union all
  select ch.child, s.a, 'aunt_uncle', 1,
         case when mid.gender = 'Female' then 'maternal' else 'paternal' end
  from sib s join par ch on ch.parent = s.b
  join person mid on mid.name = s.b
  union all
  select s.a, ch.child, 'niece_nephew', -1, null
  from sib s join par ch on ch.parent = s.b
  -- cousins
  union all
  select c1.child, c2.child, 'cousin', 0, null
  from sib s
  join par c1 on c1.parent = s.a
  join par c2 on c2.parent = s.b
  where c1.child <> c2.child
),
-- One row per (subject, other): keep the closest relationship if a pair is
-- reachable two ways (e.g. Targaryen cousins who also married).
deduped as (
  select distinct on (subj, other) subj, other, rel, tier, side
  from edges
  where subj <> other
  order by subj, other,
    array_position(array['parent','child','sibling','spouse','grandparent',
                         'grandchild','aunt_uncle','niece_nephew','cousin'], rel)
),
resolved as (
  select ps.id as hero_id, po.name as other_name, po.id as other_id,
         po.gender as other_gender, d.rel, d.tier, d.side,
         (exists (select 1 from half hf
                  where (hf.a = d.subj and hf.b = d.other)
                     or (hf.b = d.subj and hf.a = d.other))) as is_half
  from deduped d
  join person ps on ps.name = d.subj
  join person po on po.name = d.other
)
insert into public.hero_relatives
  (hero_id, name, role, relation, tier, modifiers, related_hero_id, position, branch_side)
select
  r.hero_id,
  r.other_name,
  case r.rel
    when 'parent'       then case when r.other_gender = 'Female' then 'mother' else 'father' end
    when 'child'        then case when r.other_gender = 'Female' then 'daughter' else 'son' end
    when 'sibling'      then case when r.is_half then
                                    case when r.other_gender = 'Female' then 'half-sister' else 'half-brother' end
                                  else
                                    case when r.other_gender = 'Female' then 'sister' else 'brother' end
                                  end
    when 'spouse'       then case when r.other_gender = 'Female' then 'wife' else 'husband' end
    when 'grandparent'  then case when r.other_gender = 'Female' then 'grandmother' else 'grandfather' end
    when 'grandchild'   then case when r.other_gender = 'Female' then 'granddaughter' else 'grandson' end
    when 'aunt_uncle'   then case when r.other_gender = 'Female' then 'aunt' else 'uncle' end
    when 'niece_nephew' then case when r.other_gender = 'Female' then 'niece' else 'nephew' end
    else 'cousin'
  end,
  r.rel::public.relation_kind,
  r.tier,
  case when r.is_half and r.rel = 'sibling' then array['half'] else '{}'::text[] end,
  r.other_id,
  (row_number() over (partition by r.hero_id order by r.tier desc, r.rel, r.other_name))::int - 1,
  r.side
from resolved r;
