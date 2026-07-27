-- The royal line of Atlantis.
--
-- The largest recorded kinship cluster outside Westeros: Aquaman carries
-- twenty-four relatives, more than House Stark has members.
--
-- Fourteen of them are `ancestor` at tier 2 with no `tree_parent_id`, so they
-- land in the chart's "generation unrecorded" list rather than on a rung. That
-- is left alone on purpose. Chaining them means asserting the order of the
-- Atlantean succession — which of Kordax, Orin, Shalako and Regin begat which —
-- and the catalogue does not record it. The unplaced list says "these are
-- forebears, in an order nobody wrote down", which is true; a chain I invented
-- would be the only false thing on the page.
--
-- Everyone within living memory draws normally: Atlan and Atlanna as parents,
-- Tom Curry and Porm as the adoptive pair, Mera, both sons, the brother, and
-- the aunt and uncle.
--
-- House Wayne was scoped alongside this and deliberately NOT added. Hero 69
-- ("Batman", fame 100) has Matt, Warren and Mary McGinnis recorded as his own
-- family, while the "Batman Beyond" row carries Thomas Wayne, Alfred, the Kanes
-- and the four Robins. The two rows' kinship is swapped, and a house built on
-- that would enshrine the error on a page that presents itself as a record.

insert into houses (slug, name, universe, words, seat, sigil_tint, blurb, position) values
  (
    'atlan', 'House of Atlan', 'DC Comics', null, 'Atlantis', '#0f6f7a',
    'The royal line of a drowned continent, twelve thousand years of it, running through a lighthouse keeper''s son who was left on a rock to die because he was born blond.',
    22
  );

insert into house_members (house_slug, hero_id, via) values
  ('atlan', '38', 'surname'),                                    -- Aquaman
  ('atlan', 'h_4d769a0e-23f8-41e6-a01e-a7af03cca0c9', 'surname'), -- Atlan
  ('atlan', 'h_f1c75499-7671-4b6c-986a-29c016b72fb7', 'surname'), -- Atlanna
  ('atlan', 'h_48b68adb-5ac0-4778-ad00-7d733641c2fd', 'surname'), -- Atlena
  ('atlan', 'h_6e293dc8-d5e6-45cd-ab9f-73d7902c4a09', 'surname'), -- Haumond
  ('atlan', 'h_c7226f78-e336-47ed-a7cb-47fd5adee840', 'surname'), -- Koryak
  ('atlan', 'h_31701b0d-750c-4b9c-b3ed-ee43e069a308', 'surname'), -- A.J.
  ('atlan', 'h_9d6e9cf0-12d2-4321-b702-a3b7279af029', 'surname'), -- Honsu
  ('atlan', 'h_6df3c58b-b2d0-4c83-b5f6-9f2141fadb12', 'surname'), -- Lorelei
  ('atlan', '444', 'kin'),                                        -- Mera
  ('atlan', 'h_827755d9-44d0-42c0-8cdc-33711780ca7f', 'kin'),     -- Tom Curry
  ('atlan', 'h_b6a51ca8-4dfa-4581-8883-d745dcf55fa9', 'kin'),     -- Porm
  ('atlan', 'h_ae0c7fc6-dbc1-45e8-8b46-65403394fc81', 'kin'),     -- Drin
  -- The forebears, order unrecorded.
  ('atlan', 'h_1226aa93-382d-4d4d-8c25-0f640aca3103', 'surname'), -- Kordax
  ('atlan', 'h_f4419463-055d-4c8a-898a-7a62e874982e', 'surname'), -- Orin
  ('atlan', 'h_126b8518-26b0-4a38-8bd6-156d794765af', 'surname'), -- Shalako
  ('atlan', 'h_1a1f4f30-9415-4519-93df-a590ff4e17e7', 'surname'), -- Alloroc
  ('atlan', 'h_a5a5bd58-7cec-4440-bfc0-5410bec95837', 'surname'), -- Bazil
  ('atlan', 'cv-3030', 'surname'),                                -- Cole
  ('atlan', 'h_6819a6bf-75e3-48e2-900d-f1b7e969f1fa', 'surname'), -- Cora
  ('atlan', 'h_7d616ff7-275a-4974-a020-387174f47377', 'surname'), -- Dardanus
  ('atlan', 'h_c52f9a15-3152-49f9-b67e-eddd3fbf054b', 'surname'), -- Illya
  ('atlan', 'h_a45ee0ac-5592-4ec0-8398-d3cd093cef48', 'surname'), -- Loma
  ('atlan', 'h_962c6b5f-5b63-47f7-8b5a-aa90a35c928a', 'surname'), -- Narmea
  ('atlan', 'h_17fc8197-5938-4caf-a507-f7443a293142', 'surname')  -- Regin
on conflict do nothing;
