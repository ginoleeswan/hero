-- Seven dynasties outside Westeros, from kinship the catalogue already holds.
--
-- Members are pinned by hero id, never by name. There are nine heroes called
-- "Hunter" across six publishers and six called "Crystal"; a name join would
-- have quietly seated the wrong person in half of these houses.
--
-- Membership is curated from the relation type, not from graph reach. Two hops
-- out from Magneto pulls in the entire Inhuman royal family (through Crystal)
-- and Onslaught (a psychic fusion recorded as `other`), none of whom are
-- Maximoffs. Likewise Franklin Richards' godparents are recorded with
-- relation `parent`, which would have drawn the Thing onto the parents row.
--
-- Excluded deliberately, all reachable but none of them kin:
--   Onslaught (fusee), Kang (relation `other`, empty role), Marvel Girl
--   (alternate-future spouse), Match (clone of a clone), the Pennyworths,
--   the Inhuman royal family.

-- Publisher mislabels found while resolving these. Each one silently blocks
-- franchise-scoped queries and, left alone, puts a Pixar family under Dark
-- Horse. See project_franchise_mislabel_via_series.
update heroes set publisher = 'DC Comics' where id = '564';  -- Robin V (Damian Wayne)
update heroes set publisher = 'Marvel'    where id = '726';  -- Yellowjacket (Hank Pym)
update heroes set publisher = 'Marvel'    where id = '419';  -- Luna (Quicksilver's daughter)
update heroes set publisher = 'Disney'    where id = '476';  -- Mr Incredible
update heroes set publisher = 'Disney'    where id = '236';  -- Elastigirl
update heroes set publisher = 'Marvel'    where id = 'h_4502b319-b856-4ec7-b446-395e7a320509'; -- Hunter (Wakanda)

insert into houses (slug, name, universe, words, seat, sigil_tint, blurb, position) values
  (
    'el', 'House of El', 'DC Comics', 'Stronger Together', 'Krypton', '#1b4fa0',
    'The last great line of Krypton, whose crest the world reads as an S, and whose surviving son was raised by Kansas farmers who never once asked him to be a god.',
    15
  ),
  (
    'wakanda', 'House of Wakanda', 'Marvel', 'Wakanda Forever', 'The Golden City', '#4b2e83',
    'Holders of the Panther throne in unbroken succession from Bashenga, who united five warring tribes around a fallen star and was the first to take the heart-shaped herb.',
    16
  ),
  (
    'richards', 'House Richards', 'Marvel', null, 'The Baxter Building', '#1a56b0',
    'A family that became a super-team by accident on an unshielded rocket, and whose children are more powerful than any of the four adults who raised them.',
    17
  ),
  (
    'maximoff', 'House Maximoff', 'Marvel', null, null, '#7a1f6d',
    'The most contested parentage in comics — claimed, denied and rewritten more than once — around a father who survived Auschwitz and a daughter who unmade the world with three words.',
    18
  ),
  (
    'xavier', 'House Xavier', 'Marvel', null, 'The Xavier Institute', '#2f6f8f',
    'A Westchester mansion, a fortune, and a bloodline that produced the world''s most powerful telepath, the twin who tried to be born instead of him, and the son who held both.',
    19
  ),
  (
    'allen', 'House Allen', 'DC Comics', null, 'Central City', '#b8232f',
    'Four generations of the Flash and the reporters who married them, running so far up and down the timeline that grandsons arrive before grandfathers and nobody finds it strange.',
    20
  ),
  (
    'parr', 'House Parr', 'The Incredibles', null, 'Municiberg', '#b3272d',
    'A suburban family of five under a government programme that made their whole way of life illegal, which they went on breaking roughly once a week.',
    21
  );

insert into house_members (house_slug, hero_id, via) values
  -- House of El. Superman is 644; a second row with the same name and publisher
  -- exists as a stub with no relations at all, and would draw an empty tree.
  ('el', '644', 'surname'),                                    -- Superman
  ('el', 'h_89ff9c2c-5768-483b-be41-e723ef0df460', 'surname'), -- Jor-El
  ('el', 'h_b29b139d-b88c-4114-81dd-1f2f9b4ba35d', 'surname'), -- Lara
  ('el', 'h_bd529a9f-7541-4fb7-9ee5-cf5c20def9b8', 'surname'), -- Seyg-El
  ('el', 'h_d6750e06-d6c0-45f7-b288-c7371d9f0ef8', 'surname'), -- Zor-El
  ('el', 'h_dd27979f-4d5e-4db3-9c70-da255cb60a79', 'surname'), -- Alura
  ('el', '643', 'surname'),                                    -- Supergirl
  ('el', 'cv-1686', 'kin'),                                    -- Superboy (Kon-El)
  ('el', 'cv-3617', 'kin'),                                    -- Jonathan Kent
  ('el', 'cv-3618', 'kin'),                                    -- Martha Kent
  ('el', 'cv-1808', 'kin'),                                    -- Lois Lane

  ('wakanda', '106', 'surname'),                                    -- Black Panther
  ('wakanda', 'h_170c1b60-7de7-4e69-a273-ad2b4c4d2381', 'surname'), -- Shuri
  ('wakanda', 'h_1bf9eaac-9a87-4e02-b528-07276af44e47', 'surname'), -- Jakarra
  ('wakanda', 'h_e56a00f8-109d-43dd-b383-0c3fcf8eded8', 'surname'), -- Bashenga
  ('wakanda', 'h_4502b319-b856-4ec7-b446-395e7a320509', 'kin'),     -- Hunter (adopted)
  ('wakanda', '638', 'kin'),                                        -- Storm

  ('richards', '269', 'surname'),      -- Franklin Richards
  ('richards', 'cv-2151', 'surname'),  -- Mister Fantastic
  ('richards', 'cv-2470', 'surname'),  -- Valeria Richards
  ('richards', '344', 'kin'),          -- Invisible Woman
  ('richards', '333', 'kin'),          -- Human Torch
  ('richards', '270', 'kin'),          -- Franklin Storm

  ('maximoff', '423', 'surname'),  -- Magneto
  ('maximoff', '579', 'surname'),  -- Scarlet Witch
  ('maximoff', '536', 'surname'),  -- Quicksilver
  ('maximoff', '523', 'surname'),  -- Polaris
  ('maximoff', '419', 'surname'),  -- Luna
  ('maximoff', '697', 'kin'),      -- Vision

  ('xavier', '527', 'surname'),                                    -- Professor X
  ('xavier', 'h_795dea47-b31f-4854-b73c-e719acce491d', 'surname'), -- Brian Xavier
  ('xavier', 'h_af434cbf-8a57-4e89-9470-719074841a96', 'surname'), -- Sharon Xavier
  ('xavier', 'cv-11317', 'surname'),                               -- Cassandra Nova
  ('xavier', '403', 'surname'),                                    -- Legion
  ('xavier', '374', 'kin'),                                        -- Juggernaut (stepbrother)

  ('allen', '265', 'surname'),                                  -- Flash II (Barry)
  ('allen', '266', 'surname'),                                  -- Flash III (Wally)
  ('allen', '267', 'surname'),                                  -- Flash IV
  ('allen', 'cv-1680', 'surname'),                              -- Impulse (Bart)
  ('allen', 'h_d2eb54bb-981d-4c9a-89de-e55885d553a9', 'kin'),   -- Iris West Allen

  -- The Parrs. Every one of these ids is the row that carries the kinship;
  -- higher-fame duplicates exist for Elastigirl and Dash with no relations at
  -- all, and seating those would draw five people who know nobody.
  ('parr', '476', 'surname'),  -- Mr Incredible
  ('parr', '236', 'kin'),      -- Elastigirl
  ('parr', '696', 'surname'),  -- Violet Parr
  ('parr', '209', 'surname'),  -- Dash
  ('parr', '351', 'surname')   -- Jack-Jack
on conflict do nothing;
