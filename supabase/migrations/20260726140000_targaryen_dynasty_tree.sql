-- Rebuild the Westeros family trees with the Targaryen dynasty joined end to end.
--
-- 20260726123000 derived the houses two hops deep (parents and grandparents).
-- That is the right shape for a nuclear family and the wrong shape for a
-- three-hundred-year dynasty: the Targaryens existed as three disconnected
-- islands — the Dance of the Dragons, Dunk & Egg, and the main series — because
-- the kings between them were never in the catalogue. 20260726139000 added that
-- spine; this walks it.
--
-- Two changes to the derivation:
--
-- 1. Ancestors are now recursive rather than capped at grandparents. Depth 1 and
--    2 keep their parent/grandparent relations; anything above becomes
--    relation='ancestor' with tier = generation depth. Daenerys Targaryen now
--    carries an unbroken line back to Aegon the Conqueror, thirteen generations
--    up.
--
-- 2. tree_parent_id is populated. layoutFamily nests each generation under the
--    specific ancestor it descends through, so the chain renders as a lineage
--    rather than a flat row of unattached names.
--
-- Descendants deliberately stay two deep. They fan out combinatorially where
-- ancestors converge, and the descendant half of the layout reads as "children
-- and grandchildren", not as a dynasty.
--
-- Steffon Baratheon (added with the spine) replaces the hand-written
-- Robert/Stannis/Renly sibling edges: with a father in the catalogue those
-- derive for free, and his mother Rhaelle Targaryen makes House Baratheon's
-- claim to the throne visible as an actual edge in the graph.

delete from public.hero_relatives r
using public.heroes h
where h.id = r.hero_id and h.publisher = 'Game of Thrones';

create temp table _edges (
  subj text, other text, rel text, tier int, side text, via text, is_half boolean
) on commit drop;

with recursive
par(parent, child) as (values
  -- ── House Stark ──
  ('Rickard Stark','Brandon Stark'),('Rickard Stark','Eddard Stark'),
  ('Rickard Stark','Lyanna Stark'),('Rickard Stark','Benjen Stark'),
  ('Eddard Stark','Robb Stark'),('Eddard Stark','Sansa Stark'),('Eddard Stark','Arya Stark'),
  ('Eddard Stark','Bran Stark'),('Eddard Stark','Rickon Stark'),
  ('Catelyn Stark','Robb Stark'),('Catelyn Stark','Sansa Stark'),('Catelyn Stark','Arya Stark'),
  ('Catelyn Stark','Bran Stark'),('Catelyn Stark','Rickon Stark'),
  ('Rhaegar Targaryen','Jon Snow'),('Lyanna Stark','Jon Snow'),
  -- ── Tully / Arryn ──
  ('Hoster Tully','Catelyn Stark'),('Hoster Tully','Lysa Arryn'),('Hoster Tully','Edmure Tully'),
  ('Lysa Arryn','Robert Arryn'),('John Arryn','Robert Arryn'),
  -- ── Lannister ──
  ('Tywin Lannister','Cersei Lannister'),('Tywin Lannister','Jaime Lannister'),
  ('Tywin Lannister','Tyrion Lannister'),('Kevan Lannister','Lancel Lannister'),
  ('Jaime Lannister','Joffrey Baratheon'),('Jaime Lannister','Myrcella Baratheon'),
  ('Jaime Lannister','Tommen Baratheon'),
  ('Cersei Lannister','Joffrey Baratheon'),('Cersei Lannister','Myrcella Baratheon'),
  ('Cersei Lannister','Tommen Baratheon'),
  -- ── Baratheon, now rooted in the dynasty through Rhaelle ──
  ('Steffon Baratheon','Robert Baratheon'),('Steffon Baratheon','Stannis Baratheon'),
  ('Steffon Baratheon','Renly Baratheon'),
  ('Rhaelle Targaryen','Steffon Baratheon'),
  ('Robert Baratheon','Gendry'),('Robert Baratheon','Barra'),
  ('Stannis Baratheon','Shireen Baratheon'),('Selyse Baratheon','Shireen Baratheon'),
  -- ── Greyjoy / Tyrell / Bolton / Mormont / Tarly / Frey ──
  ('Balon Greyjoy','Theon Greyjoy'),('Balon Greyjoy','Asha Greyjoy'),
  ('Olenna Tyrell','Mace Tyrell'),('Mace Tyrell','Margaery Tyrell'),
  ('Mace Tyrell','Loras Tyrell'),('Mace Tyrell','Garlan Tyrell'),
  ('Roose Bolton','Ramsay Bolton'),
  ('Jeor Mormont','Jorah Mormont'),('Maege Mormont','Lyanna Mormont'),
  ('Randyll Tarly','Samwell Tarly'),('Randyll Tarly','Dickon Tarly'),
  ('Melessa Tarly','Samwell Tarly'),('Melessa Tarly','Dickon Tarly'),
  ('Walder Frey','Stevron Frey'),
  -- ══ The Targaryen dynasty, Conquest to Daenerys ══
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
  ('Rhaelle Targaryen','Steffon Baratheon'),
  -- Dynasty marriages
  ('Aegon I Targaryen','Visenya Targaryen'),
  ('Jaehaerys I Targaryen','Alysanne Targaryen'),
  ('Viserys I Targaryen','Alicent Hightower'),
  ('Daemon Targaryen','Rhaenyra Targaryen'),
  ('Aegon II Targaryen','Helaena Targaryen'),
  ('Corlys Velaryon','Rhaenys Targaryen'),
  ('Aegon IV Targaryen','Naerys Targaryen'),
  ('Jaehaerys II Targaryen','Shaera Targaryen'),
  ('Aerys II Targaryen','Rhaella Targaryen')
),
-- Siblings whose shared parent is not in the catalogue. The Baratheon brothers
-- and Viserys I / Daemon have left this list: they now derive from Steffon
-- Baratheon and Baelon Targaryen respectively.
sib_x(a, b) as (values
  ('Tywin Lannister','Kevan Lannister'),
  ('Hoster Tully','Brynden Tully'),
  ('Balon Greyjoy','Euron Greyjoy'),('Balon Greyjoy','Victarion Greyjoy'),
  ('Balon Greyjoy','Aeron Greyjoy'),('Euron Greyjoy','Victarion Greyjoy'),
  ('Euron Greyjoy','Aeron Greyjoy'),('Victarion Greyjoy','Aeron Greyjoy'),
  ('Gregor Clegane','Sandor Clegane'),
  ('Oberyn Martell','Elia Martell'),
  ('Jeor Mormont','Maege Mormont')
),
half(a, b) as (values
  ('Rhaenyra Targaryen','Aegon II Targaryen'),
  ('Rhaenyra Targaryen','Helaena Targaryen'),
  ('Rhaenyra Targaryen','Aemond Targaryen'),
  ('Gendry','Barra'),
  ('Aenys I Targaryen','Maegor I Targaryen'),
  ('Daeron II Targaryen','Bloodraven')
),
person as (
  select id, name, gender from public.heroes where publisher = 'Game of Thrones'
),
sib as (
  select distinct a, b from (
    select p1.child as a, p2.child as b
    from par p1 join par p2 on p1.parent = p2.parent and p1.child <> p2.child
    union all select a, b from sib_x
    union all select b, a from sib_x
  ) s
),
-- Walk every bloodline upward. `via` is the ancestor one step nearer the
-- subject, which becomes the tree_parent_id and turns a flat list into a chain.
anc(subj, ancestor, depth, via) as (
  select child, parent, 1, null::text from par
  union all
  select a.subj, p.parent, a.depth + 1, a.ancestor
  from anc a
  join par p on p.child = a.ancestor
  where a.depth < 16
),
-- Targaryens married their siblings, so the same ancestor is reachable by
-- several paths. Keep the shortest.
anc_best as (
  select distinct on (subj, ancestor) subj, ancestor, depth, via
  from anc order by subj, ancestor, depth
),
edges as (
  select a.subj, a.ancestor as other,
         case a.depth when 1 then 'parent' when 2 then 'grandparent' else 'ancestor' end as rel,
         a.depth as tier,
         case when a.depth = 1 and pp.gender = 'Female' then 'maternal'
              when a.depth = 1 then 'paternal' else null end as side,
         a.via
  from anc_best a join person pp on pp.name = a.ancestor
  union all
  select c.parent, c.child, 'child', -1, null, null from par c
  union all
  select gp.parent, gc.child, 'grandchild', -2, null, null
  from par gp join par gc on gc.parent = gp.child
  union all
  select a, b, 'sibling', 0, null, null from sib
  union all
  select a, b, 'spouse', 0, 'spouse', null from mar
  union all
  select b, a, 'spouse', 0, 'spouse', null from mar
  union all
  select ch.child, s.a, 'aunt_uncle', 1,
         case when mid.gender = 'Female' then 'maternal' else 'paternal' end, null
  from sib s join par ch on ch.parent = s.b
  join person mid on mid.name = s.b
  union all
  select s.a, ch.child, 'niece_nephew', -1, null, null
  from sib s join par ch on ch.parent = s.b
  union all
  select c1.child, c2.child, 'cousin', 0, null, null
  from sib s
  join par c1 on c1.parent = s.a
  join par c2 on c2.parent = s.b
  where c1.child <> c2.child
),
deduped as (
  select distinct on (subj, other) subj, other, rel, tier, side, via
  from edges
  where subj <> other
  order by subj, other,
    array_position(array['parent','child','sibling','spouse','grandparent',
                         'grandchild','aunt_uncle','niece_nephew','ancestor','cousin'], rel)
)
insert into _edges (subj, other, rel, tier, side, via, is_half)
select d.subj, d.other, d.rel, d.tier, d.side, d.via,
       exists (select 1 from half hf
               where (hf.a = d.subj and hf.b = d.other)
                  or (hf.b = d.subj and hf.a = d.other))
from deduped d
join person ps on ps.name = d.subj
join person po on po.name = d.other;

-- Materialise, resolving names to hero rows.
insert into public.hero_relatives
  (hero_id, name, role, relation, tier, modifiers, related_hero_id, position, branch_side)
select
  ps.id,
  po.name,
  case e.rel
    when 'parent'       then case when po.gender = 'Female' then 'mother' else 'father' end
    when 'child'        then case when po.gender = 'Female' then 'daughter' else 'son' end
    when 'sibling'      then case when e.is_half then
                                    case when po.gender = 'Female' then 'half-sister' else 'half-brother' end
                                  else
                                    case when po.gender = 'Female' then 'sister' else 'brother' end end
    when 'spouse'       then case when po.gender = 'Female' then 'wife' else 'husband' end
    when 'grandparent'  then case when po.gender = 'Female' then 'grandmother' else 'grandfather' end
    when 'grandchild'   then case when po.gender = 'Female' then 'granddaughter' else 'grandson' end
    when 'aunt_uncle'   then case when po.gender = 'Female' then 'aunt' else 'uncle' end
    when 'niece_nephew' then case when po.gender = 'Female' then 'niece' else 'nephew' end
    when 'ancestor'     then
      -- tier 3 is great-grandparent; each further generation adds one "great".
      repeat('great-', e.tier - 2)
      || case when po.gender = 'Female' then 'grandmother' else 'grandfather' end
    else 'cousin'
  end,
  e.rel::public.relation_kind,
  e.tier,
  case when e.is_half and e.rel = 'sibling' then array['half'] else '{}'::text[] end,
  po.id,
  (row_number() over (partition by ps.id order by e.tier desc, e.rel, po.name))::int - 1,
  e.side
from _edges e
join public.heroes ps on ps.name = e.subj and ps.publisher = 'Game of Thrones'
join public.heroes po on po.name = e.other and po.publisher = 'Game of Thrones';

-- Chain each generation to the one below it, so the lineage renders as a line
-- rather than a flat row of names all hanging off the subject.
update public.hero_relatives r
set tree_parent_id = parent_row.id
from _edges e
join public.heroes ps on ps.name = e.subj and ps.publisher = 'Game of Thrones'
join public.hero_relatives parent_row
  on parent_row.hero_id = ps.id and parent_row.name = e.via
where r.hero_id = ps.id
  and r.name = e.other
  and e.via is not null;
