-- Batman and Batman Beyond have each other's families.
--
-- Hero `69` is Bruce Wayne — a numeric SuperheroAPI id, fame 100, and every
-- INBOUND edge agrees: Alfred calls him "legal ward", and Red Robin, Robin II
-- and Robin V all name him as their (adoptive) father. Those are right and are
-- untouched here.
--
-- His OUTBOUND relatives are Terry McGinnis's, wholesale: Warren and Mary
-- McGinnis as parents, Matt as a brother, and — the tell — a parent row whose
-- role is "biological father" and whose name is *Bruce Wayne*. Bruce is not his
-- own father; Terry is his genetic son, which is the Batman Beyond premise.
--
-- Meanwhile `h_ecba928f` ("Batman Beyond", Terry) carries Bruce's: Thomas
-- Wayne, the Kanes, Alfred as former guardian, and all four Robins as sons.
--
-- So the hero rows are named correctly and the `hero_relatives` rows are hung
-- on the wrong hero. This moves each set to its rightful owner by explicit row
-- id — sixteen of them, listed — rather than a blanket swap, so the change is
-- readable, reversible, and cannot pick up rows added since.
--
-- Reversal: run the same statements with the two hero ids exchanged.

-- Terry's four, currently on Bruce.
update hero_relatives set hero_id = 'h_ecba928f-1888-4f64-8330-c727dbf19c65'
where id in (
  'b413bc5d-af96-430e-9840-6905776295dc',  -- parent, "biological father" (Bruce Wayne)
  'c284e725-44c7-4804-822b-c89f58b8c076',  -- parent, Warren McGinnis
  '0688313a-b312-4497-867f-d26ad6156ecc',  -- parent, Mary McGinnis
  'cfee80fb-d568-4962-b243-214be800be75'   -- sibling, Matt McGinnis
) and hero_id = '69';

-- Bruce's twelve, currently on Terry.
update hero_relatives set hero_id = '69'
where id in (
  '5bc67217-122c-426b-a8d3-e875376823ad',  -- grandparent, Roderick Kane
  'a2f57e40-7b6b-466a-a2f2-5555be74fbd6',  -- grandparent, Elizabeth Kane
  'ef39b96f-fbf1-4b35-b9ca-12d2d7696005',  -- ancestor, Simon Hurt
  '41049301-a5d2-45b8-a2e5-9f5fbe1b69f7',  -- Cassandra Cain (role mangled, fixed below)
  'd22278f5-68fe-4b67-9b05-9195199a692d',  -- parent, Thomas Wayne
  '8ebdee99-f07e-4210-88a1-936b88a230b6',  -- aunt_uncle, Nathan Kane
  '02344446-d47e-4fa3-b67a-1956ee8da5ce',  -- other, Alfred Pennyworth
  'e69dadb8-f3e3-43b7-a224-2231efa0387e',  -- other, "Wayne Family"
  'cbaa056e-9ce3-4aaf-8354-9544da4a57b6',  -- child, Damian Wayne
  'b1a627f1-f545-4b7f-9ba4-c0d8697a7ba3',  -- child, Nightwing
  '1f5d7743-9c18-45be-84db-8aae159bac69',  -- child, Tim Drake
  '732238e7-9e9b-4481-a979-05908d69eb20'   -- child, Jason Todd
) and hero_id = 'h_ecba928f-1888-4f64-8330-c727dbf19c65';

-- One row was parsed across a line break and ended up holding two people: its
-- role read `adopted ward)\nMartha Wayne (mother, deceased`, which is Cassandra
-- Cain's entry with Martha Wayne's swallowed into it. Give Cassandra her own
-- role back and Martha the row she never got — the mother of the most famous
-- orphan in comics was missing from his tree entirely.
update hero_relatives
set relation = 'child', role = 'adopted ward', tier = -1
where id = '41049301-a5d2-45b8-a2e5-9f5fbe1b69f7';

insert into hero_relatives (hero_id, name, relation, role, tier, related_hero_id, position)
select '69', 'Martha Wayne', 'parent', 'mother, deceased', 1, 'cv-3603',
       coalesce((select max(position) + 1 from hero_relatives where hero_id = '69'), 0)
where not exists (
  select 1 from hero_relatives where hero_id = '69' and related_hero_id = 'cv-3603'
);
