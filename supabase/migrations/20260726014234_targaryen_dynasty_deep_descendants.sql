-- Mirror the recursive ancestor walk downward. Depth 1 and 2 keep child /
-- grandchild; below that becomes relation='descendant' with tier = -depth, and
-- tree_parent_id chains each generation to the one above so the line renders as
-- a lineage rather than a flat row.
--
-- Only the descendant half is rebuilt; ancestor, sibling, spouse, cousin and
-- aunt/uncle rows from 20260726140000 are left untouched.

delete from public.hero_relatives r
using public.heroes h
where h.id = r.hero_id
  and h.publisher = 'Game of Thrones'
  and r.relation in ('child', 'grandchild', 'descendant');

create temp table _desc (
  subj text, other text, rel text, tier int, via text
) on commit drop;

with recursive
par(parent, child) as (values
  ('Rickard Stark','Brandon Stark'),('Rickard Stark','Eddard Stark'),
  ('Rickard Stark','Lyanna Stark'),('Rickard Stark','Benjen Stark'),
  ('Eddard Stark','Robb Stark'),('Eddard Stark','Sansa Stark'),('Eddard Stark','Arya Stark'),
  ('Eddard Stark','Bran Stark'),('Eddard Stark','Rickon Stark'),
  ('Catelyn Stark','Robb Stark'),('Catelyn Stark','Sansa Stark'),('Catelyn Stark','Arya Stark'),
  ('Catelyn Stark','Bran Stark'),('Catelyn Stark','Rickon Stark'),
  ('Rhaegar Targaryen','Jon Snow'),('Lyanna Stark','Jon Snow'),
  ('Hoster Tully','Catelyn Stark'),('Hoster Tully','Lysa Arryn'),('Hoster Tully','Edmure Tully'),
  ('Lysa Arryn','Robert Arryn'),('John Arryn','Robert Arryn'),
  ('Tywin Lannister','Cersei Lannister'),('Tywin Lannister','Jaime Lannister'),
  ('Tywin Lannister','Tyrion Lannister'),('Kevan Lannister','Lancel Lannister'),
  ('Jaime Lannister','Joffrey Baratheon'),('Jaime Lannister','Myrcella Baratheon'),
  ('Jaime Lannister','Tommen Baratheon'),
  ('Cersei Lannister','Joffrey Baratheon'),('Cersei Lannister','Myrcella Baratheon'),
  ('Cersei Lannister','Tommen Baratheon'),
  ('Steffon Baratheon','Robert Baratheon'),('Steffon Baratheon','Stannis Baratheon'),
  ('Steffon Baratheon','Renly Baratheon'),
  ('Rhaelle Targaryen','Steffon Baratheon'),
  ('Robert Baratheon','Gendry'),('Robert Baratheon','Barra'),
  ('Stannis Baratheon','Shireen Baratheon'),('Selyse Baratheon','Shireen Baratheon'),
  ('Balon Greyjoy','Theon Greyjoy'),('Balon Greyjoy','Asha Greyjoy'),
  ('Olenna Tyrell','Mace Tyrell'),('Mace Tyrell','Margaery Tyrell'),
  ('Mace Tyrell','Loras Tyrell'),('Mace Tyrell','Garlan Tyrell'),
  ('Roose Bolton','Ramsay Bolton'),
  ('Jeor Mormont','Jorah Mormont'),('Maege Mormont','Lyanna Mormont'),
  ('Randyll Tarly','Samwell Tarly'),('Randyll Tarly','Dickon Tarly'),
  ('Melessa Tarly','Samwell Tarly'),('Melessa Tarly','Dickon Tarly'),
  ('Walder Frey','Stevron Frey'),
  ('Aegon I Targaryen','Aenys I Targaryen'),('Aegon I Targaryen','Maegor I Targaryen'),
  ('Visenya Targaryen','Maegor I Targaryen'),
  ('Aenys I Targaryen','Jaehaerys I Targaryen'),
  ('Jaehaerys I Targaryen','Aemon Targaryen'),('Jaehaerys I Targaryen','Baelon Targaryen'),
  ('Alysanne Targaryen','Aemon Targaryen'),('Alysanne Targaryen','Baelon Targaryen'),
  ('Aemon Targaryen','Rhaenys Targaryen'),
  ('Baelon Targaryen','Viserys I Targaryen'),('Baelon Targaryen','Daemon Targaryen'),
  ('Viserys I Targaryen','Rhaenyra Targaryen'),('Viserys I Targaryen','Aegon II Targaryen'),
  ('Viserys I Targaryen','Helaena Targaryen'),('Viserys I Targaryen','Aemond Targaryen'),
  ('Alicent Hightower','Aegon II Targaryen'),('Alicent Hightower','Helaena Targaryen'),
  ('Alicent Hightower','Aemond Targaryen'),
  ('Otto Hightower','Alicent Hightower'),
  ('Rhaenyra Targaryen','Aegon III Targaryen'),('Rhaenyra Targaryen','Viserys II Targaryen'),
  ('Daemon Targaryen','Aegon III Targaryen'),('Daemon Targaryen','Viserys II Targaryen'),
  ('Aegon III Targaryen','Daeron I Targaryen'),('Aegon III Targaryen','Baelor I Targaryen'),
  ('Viserys II Targaryen','Aegon IV Targaryen'),('Viserys II Targaryen','Naerys Targaryen'),
  ('Viserys II Targaryen','Aemon the Dragonknight'),
  ('Aegon IV Targaryen','Daeron II Targaryen'),('Naerys Targaryen','Daeron II Targaryen'),
  ('Aegon IV Targaryen','Bloodraven'),
  ('Daeron II Targaryen','Baelor Targaryen'),('Daeron II Targaryen','Aerys I Targaryen'),
  ('Daeron II Targaryen','Rhaegel Targaryen'),('Daeron II Targaryen','Maekar Targaryen'),
  ('Baelor Targaryen','Valarr Targaryen'),
  ('Maekar Targaryen','Daeron Targaryen'),('Maekar Targaryen','Aerion Brightflame'),
  ('Maekar Targaryen','Aegon V Targaryen'),('Maekar Targaryen','Maester Aemon'),
  ('Aegon V Targaryen','Duncan Targaryen'),('Aegon V Targaryen','Jaehaerys II Targaryen'),
  ('Aegon V Targaryen','Shaera Targaryen'),('Aegon V Targaryen','Rhaelle Targaryen'),
  ('Jaehaerys II Targaryen','Aerys II Targaryen'),('Jaehaerys II Targaryen','Rhaella Targaryen'),
  ('Shaera Targaryen','Aerys II Targaryen'),('Shaera Targaryen','Rhaella Targaryen'),
  ('Aerys II Targaryen','Rhaegar Targaryen'),('Aerys II Targaryen','Viserys Targaryen'),
  ('Aerys II Targaryen','Daenerys Targaryen'),
  ('Rhaella Targaryen','Rhaegar Targaryen'),('Rhaella Targaryen','Viserys Targaryen'),
  ('Rhaella Targaryen','Daenerys Targaryen')
),
person as (
  select id, name, gender from public.heroes where publisher = 'Game of Thrones'
),
desc_walk(subj, descendant, depth, via) as (
  select parent, child, 1, null::text from par
  union all
  select d.subj, p.child, d.depth + 1, d.descendant
  from desc_walk d
  join par p on p.parent = d.descendant
  where d.depth < 16
),
-- Cousin marriages make the same descendant reachable by several paths; keep
-- the shortest, exactly as the ancestor walk does.
desc_best as (
  select distinct on (subj, descendant) subj, descendant, depth, via
  from desc_walk order by subj, descendant, depth
)
insert into _desc (subj, other, rel, tier, via)
select d.subj, d.descendant,
       case d.depth when 1 then 'child' when 2 then 'grandchild' else 'descendant' end,
       -d.depth, d.via
from desc_best d
join person ps on ps.name = d.subj
join person po on po.name = d.descendant
where d.subj <> d.descendant;

insert into public.hero_relatives
  (hero_id, name, role, relation, tier, modifiers, related_hero_id, position, branch_side)
select
  ps.id,
  po.name,
  case e.rel
    when 'child'      then case when po.gender = 'Female' then 'daughter' else 'son' end
    when 'grandchild' then case when po.gender = 'Female' then 'granddaughter' else 'grandson' end
    else
      case
        when -e.tier = 3 then 'great-'
        when -e.tier = 4 then 'great-great-'
        else (-e.tier - 2) || '× great-'
      end
      || case when po.gender = 'Female' then 'granddaughter' else 'grandson' end
  end,
  e.rel::public.relation_kind,
  e.tier,
  '{}'::text[],
  po.id,
  1000 + (row_number() over (partition by ps.id order by e.tier desc, po.name))::int,
  null
from _desc e
join public.heroes ps on ps.name = e.subj and ps.publisher = 'Game of Thrones'
join public.heroes po on po.name = e.other and po.publisher = 'Game of Thrones';

update public.hero_relatives r
set tree_parent_id = parent_row.id
from _desc e
join public.heroes ps on ps.name = e.subj and ps.publisher = 'Game of Thrones'
join public.hero_relatives parent_row
  on parent_row.hero_id = ps.id and parent_row.name = e.via
where r.hero_id = ps.id
  and r.name = e.other
  and e.via is not null
  and r.relation in ('child', 'grandchild', 'descendant');;
