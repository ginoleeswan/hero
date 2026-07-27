-- House Wayne, now that Bruce has his own family back (see the migration
-- immediately before this one).
--
-- Almost none of this house is blood, which is the point of it: one son, one
-- ward, three adopted, and a butler recorded as "former guardian". The tree
-- already models that through `role`, so it reads as what it is rather than
-- pretending to a bloodline.
--
-- Seated by the ids Bruce's own edges point at — cv-1691, cv-9290, cv-6849,
-- cv-42413 — and NOT their persona duplicates (Nightwing/Red Robin 549,
-- Robin II 562, Robin V 564), which are separate hero rows for the same four
-- people. Seating both sets would list every Robin twice. The duplicates are a
-- known catalogue problem, not something to paper over here.

insert into houses (slug, name, universe, words, seat, sigil_tint, blurb, position) values
  (
    'wayne', 'House Wayne', 'DC Comics', null, 'Wayne Manor', '#3d4a6b',
    'A fortune, a butler, and a succession of orphans, held together by a man who could not stop adopting the children he met on the worst night of their lives.',
    23
  );

insert into house_members (house_slug, hero_id, via) values
  ('wayne', '69', 'surname'),                                    -- Batman (Bruce Wayne)
  ('wayne', 'cv-3602', 'surname'),                               -- Thomas Wayne
  ('wayne', 'cv-3603', 'surname'),                               -- Martha Wayne
  ('wayne', 'cv-42413', 'surname'),                              -- Damian Wayne
  ('wayne', 'h_9f6bde3f-f0e0-45a0-85d0-da8bcc8f421e', 'kin'),    -- Roderick Kane
  ('wayne', 'h_de593403-c69a-4004-a86a-b4ba771699ef', 'kin'),    -- Elizabeth Kane
  ('wayne', 'cv-1691', 'kin'),                                   -- Nightwing (adopted)
  ('wayne', 'cv-9290', 'kin'),                                   -- Tim Drake (adopted)
  ('wayne', 'cv-6849', 'kin'),                                   -- Jason Todd (adopted)
  ('wayne', 'h_a557c2ae-3483-43c4-bc80-d71f5df2007c', 'kin'),    -- Cassandra Cain (ward)
  ('wayne', 'cv-4917', 'kin'),                                   -- Talia al Ghul
  -- Terry and the McGinnises: Bruce is his biological father, which is the
  -- whole premise of Batman Beyond and the only blood link on the page besides
  -- Damian.
  ('wayne', 'h_ecba928f-1888-4f64-8330-c727dbf19c65', 'kin'),    -- Batman Beyond (Terry)
  ('wayne', 'h_f7c54a19-c27a-4558-acb7-8d82b1b43860', 'kin'),    -- Warren McGinnis
  ('wayne', 'h_1688732c-d4ef-434d-87e1-6e3682a88749', 'kin'),    -- Mary McGinnis
  ('wayne', 'h_84d16a70-3fe1-4110-8a1d-736e224ede72', 'kin')     -- Matt McGinnis
on conflict do nothing;
