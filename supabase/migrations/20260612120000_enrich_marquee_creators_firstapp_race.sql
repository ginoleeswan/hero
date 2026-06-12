-- Enrich marquee heroes with the two gap fields the app renders straight from the
-- DB row and that ComicVine never supplies to the render path:
--
--   * race              -> stats.appearance.race  (Dossier "Race" row)
--   * first_appearance  -> stats.biography.first-appearance
--                          (Dossier "First appearance" row; also the Spotlight
--                           panel / first-appearance gallery captions)
--
-- WHY ONLY THESE TWO FIELDS:
-- The character screen overwrites `details` (summary, creators, powers, movies,
-- first_issue_data...) with a LIVE ComicVine fetch whenever a row looks
-- incomplete. ComicVine is the authoritative source for creators/powers, so we
-- deliberately do NOT hand-author those here — they would be silently replaced
-- on screen and risk conflicting with ComicVine. `race` and `first_appearance`
-- live in the `stats` object, which the live fetch never touches, so they are
-- DB-authoritative and always rendered. The text first_appearance is also a
-- graceful fallback: it hides automatically once a hero gains a ComicVine cover
-- (the visual "First Appearance" debut card), so it never duplicates that card.
--
-- Scope is SELECTIVE: only well-known Marvel / DC / Image / Archie characters in
-- the high-visibility (top issue_count + categorized) set whose first appearance
-- and race are stable and confidently known. Funny-animal and obscure supporting
-- cast are intentionally excluded. Every column is guarded so existing non-empty
-- data is NEVER overwritten — this only fills gaps.

with v(id, first_appearance, race) as (
  values
    -- DC ----------------------------------------------------------------------
    ('cv-1691', 'Detective Comics #38', 'Human'),            -- Dick Grayson
    ('cv-1808', 'Action Comics #1', 'Human'),                -- Lois Lane
    ('cv-3727', 'Detective Comics #27', 'Human'),            -- James Gordon
    ('cv-3213', 'Action Comics #6', 'Human'),                -- Jimmy Olsen
    ('cv-1809', 'Superman #7', 'Human'),                     -- Perry White
    ('cv-2350', 'Whiz Comics #2', 'Human'),                  -- Billy Batson
    ('cv-4913', 'The Brave and the Bold #60', 'Amazon'),     -- Donna Troy
    ('cv-3404', 'More Fun Comics #73', 'Human'),             -- Roy Harper
    ('cv-4885', 'Detective Comics #58', 'Human'),            -- Penguin
    ('cv-3586', 'The Doom Patrol #99', 'Human'),             -- Beast Boy
    ('cv-2395', 'Flash Comics #1', 'Human'),                 -- Jay Garrick
    ('cv-3617', 'Superman #1', 'Human'),                     -- Jonathan Kent
    ('cv-3618', 'Superman #1', 'Human'),                     -- Martha Kent
    ('cv-3584', 'DC Comics Presents #26', 'Human-Demon Hybrid'), -- Raven
    ('cv-4915', 'All Star Comics #58', 'Kryptonian'),        -- Power Girl
    ('cv-1686', 'The Adventures of Superman #500', 'Kryptonian'), -- Kon-El
    ('cv-3718', 'Detective Comics #140', 'Human'),           -- Riddler
    ('cv-3726', 'World''s Finest Comics #3', 'Human'),       -- Scarecrow
    ('cv-3329', 'The Saga of the Swamp Thing #37', 'Human'), -- John Constantine
    ('cv-3725', 'Batman #357', 'Human'),                     -- Killer Croc
    ('cv-3588', 'The New Teen Titans #2', 'Human'),          -- Deathstroke
    ('cv-4684', 'Action Comics #242', 'Coluan'),             -- Brainiac
    ('cv-3715', 'Batman #121', 'Human'),                     -- Mr. Freeze
    ('cv-1690', 'The Huntress #1', 'Human'),                 -- Huntress (Bertinelli)
    ('cv-4437', 'The Flash #112', 'Human'),                  -- Elongated Man
    ('cv-1786', 'Booster Gold #1', 'Human'),                 -- Booster Gold
    ('cv-1680', 'The Flash #92', 'Human'),                   -- Bart Allen
    ('cv-4920', 'Legends #1', 'Human'),                      -- Amanda Waller
    ('cv-3602', 'Detective Comics #33', 'Human'),            -- Thomas Wayne
    ('cv-2384', 'The Brave and the Bold #57', 'Human'),      -- Metamorpho
    ('cv-2356', 'Captain Marvel Adventures #18', 'Human'),   -- Mary Marvel
    ('cv-2054', 'Captain Atom #83', 'Human'),                -- Ted Kord
    ('cv-4929', 'All Star Comics #8', 'Amazon'),             -- Hippolyta
    ('cv-1273', 'Adventure Comics #247', 'Titanian'),        -- Saturn Girl
    ('cv-1264', 'Adventure Comics #247', 'Braalian'),        -- Cosmic Boy
    -- Marvel --------------------------------------------------------------------
    ('cv-3552', 'The X-Men #1', 'Mutant'),                   -- Jean Grey
    ('cv-2151', 'The Fantastic Four #1', 'Human'),           -- Mr. Fantastic
    ('cv-3548', 'Uncanny X-Men #129', 'Mutant'),             -- Kitty Pryde
    ('cv-3176', 'Captain Britain #8', 'Mutant'),             -- Betsy Braddock
    ('cv-3202', 'Sgt. Fury and his Howling Commandos #1', 'Human'), -- Nick Fury
    ('cv-3200', 'Tales of Suspense #52', 'Human'),           -- Black Widow
    ('cv-2247', 'Tales to Astonish #27', 'Human'),           -- Hank Pym
    ('cv-3546', 'The X-Men #54', 'Mutant'),                  -- Havok
    ('cv-4563', 'Iron Fist #14', 'Mutant'),                  -- Sabretooth
    ('cv-1487', 'The Amazing Spider-Man #1', 'Human'),       -- J. Jonah Jameson
    ('cv-4562', 'Uncanny X-Men #244', 'Mutant'),             -- Jubilee
    ('cv-4644', 'Marvel Graphic Novel #4', 'Mutant'),        -- Sunspot
    ('cv-1780', 'Amazing Fantasy #15', 'Human'),             -- Aunt May
    ('cv-3566', 'Uncanny X-Men #141', 'Mutant'),             -- Rachel Summers
    ('cv-4557', 'Marvel Graphic Novel #4', 'Mutant'),        -- Wolfsbane
    ('cv-1451', 'Captain America #117', 'Human'),            -- Sam Wilson
    ('cv-1463', 'Marvel Graphic Novel #4', 'Human'),         -- Moonstar
    ('cv-3560', 'NYX #3', 'Mutant'),                         -- X-23
    ('cv-4324', 'Journey into Mystery #85', 'Frost Giant'),  -- Loki
    ('cv-4279', 'Uncanny X-Men #184', 'Mutant'),             -- Forge
    ('cv-3179', 'Uncanny X-Men #221', 'Mutant'),             -- Mr. Sinister
    ('cv-3182', 'The X-Men #3', 'Mutant'),                   -- Blob
    ('cv-3190', 'Uncanny X-Men #120', 'Mutant'),             -- Northstar
    ('cv-1480', 'The Amazing Spider-Man #31', 'Human'),      -- Gwen Stacy
    ('cv-3457', 'The Incredible Hulk #1', 'Human'),          -- Thunderbolt Ross
    ('cv-3544', 'The Amazing Spider-Man #4', 'Human'),       -- Sandman (Flint Marko)
    ('cv-4329', 'Fantastic Four #45', 'Inhuman'),            -- Black Bolt
    ('cv-3507', 'Journey into Mystery #85', 'Asgardian'),    -- Odin
    ('cv-2478', 'The Amazing Spider-Man #31', 'Human'),      -- Harry Osborn
    ('cv-4647', 'Daredevil #131', 'Human'),                  -- Bullseye
    ('cv-3316', 'The Avengers #144', 'Human'),               -- Hellcat (Patsy Walker)
    ('cv-3172', 'The Avengers #47', 'Human'),                -- Black Knight (Dane Whitman)
    ('cv-4484', 'The Amazing Spider-Man #20', 'Human'),      -- Scorpion (Mac Gargan)
    ('cv-3554', 'Uncanny X-Men #141', 'Mutant'),             -- Pyro
    ('cv-4327', 'Fantastic Four #36', 'Inhuman'),            -- Medusa
    ('cv-2248', 'The Incredible Hulk #1', 'Human'),          -- Rick Jones
    ('cv-3181', 'Spider-Woman #37', 'Mutant'),               -- Siryn
    ('cv-3175', 'The X-Men #64', 'Mutant'),                  -- Sunfire
    ('cv-4442', 'Astonishing X-Men #4', 'Mutant'),           -- Armor
    ('cv-4558', 'The New Mutants #8', 'Mutant'),             -- Magma
    ('cv-4559', 'Uncanny X-Men #132', 'Mutant'),             -- Sage
    ('cv-3526', 'Sgt. Fury and his Howling Commandos #1', 'Human'), -- Dum Dum Dugan
    ('cv-4459', 'The Amazing Spider-Man #2', 'Human'),       -- Vulture
    ('cv-2164', 'The X-Men #101', 'Cosmic Entity'),          -- Phoenix Force
    ('cv-2484', 'The Amazing Spider-Man #4', 'Human'),       -- Betty Brant
    ('cv-1782', 'The Amazing Spider-Man #51', 'Human'),      -- Robbie Robertson
    ('cv-1781', 'Tales of Suspense #59', 'Human'),           -- Jarvis
    ('cv-3445', 'The Incredible Hulk #1', 'Human'),          -- Betty Ross
    ('cv-1489', 'Amazing Fantasy #15', 'Human'),             -- Flash Thompson
    ('cv-2439', 'Conan the Barbarian #23', 'Human'),         -- Red Sonja
    ('710',     'Marvel Comics Presents #72', 'Mutant'),     -- Weapon X
    -- Image ---------------------------------------------------------------------
    ('cv-3381', 'Spawn #1', 'Hellspawn'),                    -- Spawn
    -- Archie --------------------------------------------------------------------
    ('cv-1722', 'Archie''s Mad House #22', 'Human')          -- Sabrina Spellman
)
update heroes h
set
  first_appearance = case
      when (h.first_appearance is null or h.first_appearance = '') and v.first_appearance is not null
      then v.first_appearance else h.first_appearance end,
  race = case
      when (h.race is null or h.race = '') and v.race is not null
      then v.race else h.race end
from v
where h.id = v.id;
