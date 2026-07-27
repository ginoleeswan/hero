-- Three famous families, unlocked by the linking migration before this one.
--
-- None of these needed a new relation invented. They needed `related_hero_id`
-- filled in on rows that already named the right people in free text — most
-- memorably Luke's sibling row, which read "Princes Leia" and so never resolved.
--
-- Skywalker seats Han as `kin`: he marries in, and he is the only member with
-- no Skywalker blood. Rey is left out — the catalogue records no relation for
-- her at all, and her parentage is the one thing about her the films kept
-- changing.
--
-- Summers has no seat. The family is scattered across a galaxy, three
-- timelines and at least two clone plots; giving it a castle would be the only
-- tidy thing about it.

insert into houses (slug, name, universe, words, seat, sigil_tint, blurb, position) values
  (
    'skywalker', 'House Skywalker', 'Star Wars', null, 'Tatooine', '#1d6fa8',
    'A slave boy from a desert world, the twins he never raised, and a grandson who took his mask out of the ashes — three generations that between them lost a galaxy twice and saved it twice.',
    24
  ),
  (
    'odinson', 'House Odinson', 'Marvel', null, 'Asgard', '#b8862b',
    'The throne of Asgard, an adopted son who has never once let anyone forget it, and a family whose quarrels are recorded as prophecy because they end worlds.',
    25
  ),
  (
    'summers', 'House Summers', 'Marvel', null, null, '#c25a1f',
    'The most tangled bloodline in comics: three brothers scattered across a galaxy, a wife who turned out to be a clone of the other wife, and a son raised two thousand years in the future who came back older than his father.',
    26
  );

insert into house_members (house_slug, hero_id, via) values
  ('skywalker', '208', 'surname'),       -- Darth Vader
  ('skywalker', '418', 'surname'),       -- Luke Skywalker
  ('skywalker', 'cv-33545', 'surname'),  -- Princess Leia
  ('skywalker', '398', 'surname'),       -- Kylo Ren
  ('skywalker', 'cv-2608', 'kin'),       -- Han Solo

  ('odinson', 'cv-3507', 'surname'),     -- Odin
  ('odinson', '659', 'surname'),         -- Thor
  ('odinson', 'cv-4324', 'surname'),     -- Loki
  ('odinson', '321', 'surname'),         -- Hela
  ('odinson', 'h_d91afb39-6b0b-4be7-a8a7-69691d50a73e', 'kin'), -- Frigga

  ('summers', '196', 'surname'),         -- Cyclops (Scott)
  ('summers', 'cv-3546', 'surname'),     -- Havok (Alex)
  ('summers', 'cv-21233', 'surname'),    -- Vulcan (Gabriel)
  ('summers', '145', 'surname'),         -- Cable (Nathan)
  ('summers', '330', 'surname'),         -- Hope Summers
  ('summers', 'cv-3552', 'kin'),         -- Jean Grey
  ('summers', 'cv-10981', 'kin')         -- Madelyne Pryor
on conflict do nothing;
