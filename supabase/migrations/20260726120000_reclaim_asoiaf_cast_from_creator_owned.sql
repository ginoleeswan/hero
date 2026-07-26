-- Reclaim the A Song of Ice and Fire cast out of the "Creator-Owned" bucket.
--
-- ComicVine ingested the full comic-adaptation cast of A Game of Thrones,
-- A Clash of Kings and the Dunk & Egg novellas, but the publisher heuristic
-- landed them all on "Creator-Owned" with no franchise. 240 rows — Ygritte,
-- Margaery, Renly, Loras, Barristan, Jaqen H'ghar, Podrick, Qyburn, Roose
-- Bolton, Walder Frey, Rhaegar, Lyanna, all three dragons and all six
-- direwolves — sat invisible next to the 31 heroes already tagged
-- "Game of Thrones".
--
-- Two things were broken by the split, not just the universe page:
--   1. /universe/game-of-thrones showed 31 of a 271-strong cast.
--   2. The family-tree linker (20260725170000) only links a relative to a hero
--      when both sides share a publisher. Every Stark->Stark and
--      Lannister->Lannister link was being refused because half the house was
--      "Creator-Owned". Reclaiming these is what makes the trees connectable.
--
-- Identified by first_issue_data->>'seriesName', which is exact here — every
-- one of these series is unambiguously ASOIAF. "George R.R. Martin's Doorways"
-- is deliberately excluded: it is his unrelated sci-fi TV pilot.
--
-- franchise splits the two eras inside the one universe, matching the two-tier
-- universe model (owner/studio badge + franchise sub-group).

-- 1. Main-line series -> A Song of Ice and Fire (matches the existing 31 rows).
update public.heroes
set publisher = 'Game of Thrones',
    franchise = 'A Song of Ice and Fire'
where publisher is distinct from 'Game of Thrones'
  and first_issue_data->>'seriesName' ilike any (array[
    '%A Game of Thrones%',
    '%A Clash of Kings%'
  ])
  and first_issue_data->>'seriesName' not ilike '%Doorways%';

-- 2. The Dunk & Egg novellas -> same universe, own franchise. Set ~90 years
--    before the main series, so they group as their own era rather than
--    diluting the ASOIAF sub-group.
update public.heroes
set publisher = 'Game of Thrones',
    franchise = 'Dunk & Egg'
where publisher is distinct from 'Game of Thrones'
  and first_issue_data->>'seriesName' ilike any (array[
    '%Hedge Knight%',
    '%Sworn Sword%',
    '%Mystery Knight%'
  ]);

-- 3. One straggler with no first_issue_data at all. ComicVine id 147665 sits
--    inside the contiguous 147xxx block held by the A Game of Thrones cast
--    (147666 Pimple, 147667 Dareon), and the name is unique in the catalogue.
update public.heroes
set publisher = 'Game of Thrones',
    franchise = 'A Song of Ice and Fire'
where id = 'h_5e7d24dd-a54a-4fc3-b610-f6f7e5215b76'
  and name = 'Janos Slynt'
  and comicvine_id = '147665';
