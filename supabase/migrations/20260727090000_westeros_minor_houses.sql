-- Six more houses of Westeros.
--
-- Nineteen characters were sitting in the catalogue with their kinship already
-- recorded and no house to belong to — Samwell Tarly knew his father, Sandor
-- knew his brother, and neither had a page that said so.
--
-- Only clusters whose relations actually resolve to another hero are here. The
-- surname-only ones (Cassel, Umber, Manderly, Reed, Royce, Seaworth, Tallhart,
-- Payne) are deliberately left out: with no recorded kin between them a house
-- page draws its empty state, which is worse than not existing. They become
-- houses when someone records the relations, not before.
--
-- Every relation in this set is tier 0 or 1 (parents, siblings, children), so a
-- null `tree_parent_id` is correct — only tier-2-and-deeper forebears need the
-- chain. See docs/architecture/family-trees-and-houses.md.
--
-- `words` and `seat` are null where the source has none. House Frey famously
-- has no words, and inventing one would be the only false thing on the page.

insert into houses (slug, name, universe, words, seat, sigil_tint, blurb, position) values
  (
    'arryn', 'House Arryn', 'Game of Thrones', 'As High as Honor', 'The Eyrie', '#4a72a8',
    'Kings of Mountain and Vale and the purest of the Andal lords, seated in a castle no army has ever taken and a good many men have been thrown out of.',
    9
  ),
  (
    'bolton', 'House Bolton', 'Game of Thrones', 'Our Blades Are Sharp', 'The Dreadfort', '#8e2f3f',
    'Lords of the Dreadfort, who once flayed Starks and hung their skins in the cellars, and who went on doing it long after the crown forbade it.',
    10
  ),
  (
    'frey', 'House Frey', 'Game of Thrones', null, 'The Twins', '#6d7a86',
    'Six hundred years of tolls at the only bridge across the Green Fork, a great many children, and one wedding the Seven Kingdoms will never stop talking about.',
    11
  ),
  (
    'mormont', 'House Mormont', 'Game of Thrones', 'Here We Stand', 'Bear Island', '#2f4f3a',
    'Rulers of Bear Island, where the women take up arms when the men are away, and whose ten-year-old lady shamed a hall of grown lords into fighting.',
    12
  ),
  (
    'tarly', 'House Tarly', 'Game of Thrones', 'First in Battle', 'Horn Hill', '#4a6b32',
    'Marcher lords of the Reach and the finest field commanders in Westeros, whose heir preferred books and was told to take the black or be hunted down for the inheritance.',
    13
  ),
  (
    'clegane', 'House Clegane', 'Game of Thrones', null, 'Clegane''s Keep', '#a8781c',
    'Landed knights raised in three generations from kennelmaster to the most feared blade in the realm — and the younger brother who feared him most.',
    14
  );

-- Members. `via` follows the existing convention: 'surname' for those who bear
-- the name, 'kin' for those married or related into it.
insert into house_members (house_slug, hero_id, via)
select v.house_slug, h.id, v.via
from (values
  -- Arryn. Lysa and Robert already sit in Tully and Stark; a person can belong
  -- to more than one house, which is the whole point of a marriage alliance.
  ('arryn',   'John Arryn',        'surname'),
  ('arryn',   'Robert Arryn',      'surname'),
  ('arryn',   'Lysa Arryn',        'kin'),

  ('bolton',  'Roose Bolton',      'surname'),
  ('bolton',  'Ramsay Bolton',     'surname'),

  ('frey',    'Walder Frey',       'surname'),
  ('frey',    'Stevron Frey',      'surname'),
  ('frey',    'Big Walder Frey',   'surname'),
  ('frey',    'Little Walder Frey','surname'),
  ('frey',    'Cleos Frey',        'surname'),
  ('frey',    'Joyeuse Frey',      'kin'),

  ('mormont', 'Jeor Mormont',      'surname'),
  ('mormont', 'Jorah Mormont',     'surname'),
  ('mormont', 'Maege Mormont',     'surname'),
  ('mormont', 'Lyanna Mormont',    'surname'),
  ('mormont', 'Lynesse Hightower', 'kin'),

  ('tarly',   'Randyll Tarly',     'surname'),
  ('tarly',   'Samwell Tarly',     'surname'),
  ('tarly',   'Dickon Tarly',      'surname'),
  ('tarly',   'Melessa Tarly',     'kin'),

  ('clegane', 'Gregor Clegane',    'surname'),
  ('clegane', 'Sandor Clegane',    'surname')
) as v(house_slug, hero_name, via)
join heroes h
  on h.name = v.hero_name
 and h.franchise = 'A Song of Ice and Fire'
on conflict do nothing;
