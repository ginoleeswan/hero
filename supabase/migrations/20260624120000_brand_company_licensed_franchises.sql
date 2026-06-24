-- Re-brand the "Company-Licensed" bucket onto recognizable franchise/IP brands.
--
-- "Company-Licensed" is a SuperheroAPI placeholder, not a publisher: it holds
-- licensed IP that never had a single comic publisher (the comics changed hands
-- per decade). Per the two-tier model we badge axis 1 = owner/brand (the
-- strongest recognizable, stable brand in the ownership chain) and leave axis 2
-- = franchise/series to a later sub-grouping pass.
--
-- This migration handles only the HIGH-CONFIDENCE clusters and singletons that
-- can be hand-identified by character name. The Star Wars Expanded-Universe
-- long tail (~400 obscure rows, plus in-bucket name collisions like Jade/
-- Scorpion/Angel/Jason) is intentionally left as 'Company-Licensed' here and
-- resolved separately by a ComicVine/Wikidata-verified pass.
--
-- Every UPDATE is scoped to publisher = 'Company-Licensed' AND an explicit
-- comicvine_id list, so it cannot touch a same-named hero under another
-- publisher.

-- NetherRealm Studios (Mortal Kombat; was Midway — see note, studio is the axis-1 brand)
UPDATE heroes SET publisher = 'NetherRealm Studios'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '47818','49420','42243','49423','15719','42244','49416','44812','49431',
  '49430','47119','53257','42245','15541','49353','49494','49164','53338',
  '49424','59742','90084','53469','49422','62882','49444','65512','166268',
  '90077','90194','65510','112369','112368'
]);

-- Avatar: The Last Airbender
UPDATE heroes SET publisher = 'Avatar: The Last Airbender'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '47646','25622','47733','47634','47769','48106','47559','48104','47768',
  '52564','99809'
]);

-- Star Trek
UPDATE heroes SET publisher = 'Star Trek'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '20079','20078','20105','20071'
]);

-- Babylon 5
UPDATE heroes SET publisher = 'Babylon 5'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '4495','4504','4496','4498','4511','4500','4515','4499','4512','4509',
  '4502','4501','4517','4490','4514','4516','4526','4510','4491','4492'
]);

-- Looney Tunes
UPDATE heroes SET publisher = 'Looney Tunes'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '2860','2861','2859','2868','3162','2864','21383','2970'
]);

-- Hanna-Barbera (Flintstones, Top Cat, Space Ghost)
UPDATE heroes SET publisher = 'Hanna-Barbera'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '2926','2929','2927','2928','2933','2930','2676','43703'
]);

-- Conan / Red Sonja (Robert E. Howard's Hyboria)
UPDATE heroes SET publisher = 'Conan'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '2438','2439','2370'
]);

-- CD Projekt Red (The Witcher; studio is the axis-1 brand, franchise = axis 2)
UPDATE heroes SET publisher = 'CD Projekt Red'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '49020','134196','132393','154293','189737','189739'
]);

-- Teenage Mutant Ninja Turtles
UPDATE heroes SET publisher = 'Teenage Mutant Ninja Turtles'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '44711','44709','39812','9779'
]);

-- The Green Hornet
UPDATE heroes SET publisher = 'The Green Hornet'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '4767','4764','4787','4788','4771'
]);

-- Rocky & Bullwinkle (Jay Ward)
UPDATE heroes SET publisher = 'Rocky & Bullwinkle'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '2664','2453','2454','2455','2456','2457'
]);

-- Gatchaman / Battle of the Planets (G-Force)
UPDATE heroes SET publisher = 'Gatchaman'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '1355','1356','1353','1357','1354','1360','1358','1359'
]);

-- Insomniac Games (Ratchet & Clank; studio is the axis-1 brand, franchise = axis 2)
UPDATE heroes SET publisher = 'Insomniac Games'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '46815','48331','166580','169495','169496'
]);

-- SNK fighters (King of Fighters / Fatal Fury / Art of Fighting / Samurai Shodown)
UPDATE heroes SET publisher = 'SNK'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '1427','1379','3054','3812','3299','3166','3300','3816','3811','3814'
]);

-- Harvey Comics (publisher-original characters mis-bucketed as licensed)
UPDATE heroes SET publisher = 'Harvey Comics'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '2743','2647'
]);

-- Single-property franchises (one or two recognizable characters each)
UPDATE heroes SET publisher = 'The Terminator'           WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY['13852','51954']);
UPDATE heroes SET publisher = 'RoboCop'                  WHERE publisher = 'Company-Licensed' AND comicvine_id = '28671';
UPDATE heroes SET publisher = 'A Nightmare on Elm Street' WHERE publisher = 'Company-Licensed' AND comicvine_id = '41460';
UPDATE heroes SET publisher = 'Friday the 13th'          WHERE publisher = 'Company-Licensed' AND comicvine_id = '41459';
UPDATE heroes SET publisher = 'Hellraiser'               WHERE publisher = 'Company-Licensed' AND comicvine_id = '41465';
UPDATE heroes SET publisher = 'Halloween'                WHERE publisher = 'Company-Licensed' AND comicvine_id = '46825';
UPDATE heroes SET publisher = 'Child''s Play'            WHERE publisher = 'Company-Licensed' AND comicvine_id = '51515';
UPDATE heroes SET publisher = 'Alien'                    WHERE publisher = 'Company-Licensed' AND comicvine_id = '61046';
UPDATE heroes SET publisher = 'Predator'                 WHERE publisher = 'Company-Licensed' AND comicvine_id = '53668';
UPDATE heroes SET publisher = 'Darkman'                  WHERE publisher = 'Company-Licensed' AND comicvine_id = '42133';
UPDATE heroes SET publisher = 'Santa Monica Studio'      WHERE publisher = 'Company-Licensed' AND comicvine_id = '67170'; -- God of War
UPDATE heroes SET publisher = 'Crystal Dynamics'         WHERE publisher = 'Company-Licensed' AND comicvine_id = '40491'; -- Tomb Raider
UPDATE heroes SET publisher = 'Namco'                    WHERE publisher = 'Company-Licensed' AND comicvine_id = '1971'; -- Pac-Man
UPDATE heroes SET publisher = 'Bungie'                   WHERE publisher = 'Company-Licensed' AND comicvine_id = '44581'; -- Halo
UPDATE heroes SET publisher = 'Ben 10'                   WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY['48499','49872']);
UPDATE heroes SET publisher = 'Captain Planet'           WHERE publisher = 'Company-Licensed' AND comicvine_id = '44658';
UPDATE heroes SET publisher = 'Indiana Jones'            WHERE publisher = 'Company-Licensed' AND comicvine_id = '13767';
UPDATE heroes SET publisher = 'Rocky'                    WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY['3522','3901']);
UPDATE heroes SET publisher = 'ALF'                      WHERE publisher = 'Company-Licensed' AND comicvine_id = '2412';
UPDATE heroes SET publisher = 'Little Orphan Annie'      WHERE publisher = 'Company-Licensed' AND comicvine_id = '2975';
UPDATE heroes SET publisher = 'Alvin and the Chipmunks'  WHERE publisher = 'Company-Licensed' AND comicvine_id = '2968';
UPDATE heroes SET publisher = 'Sesame Street'            WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY['3376','2724']);
UPDATE heroes SET publisher = 'The Muppets'              WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY['2992','2989']);
UPDATE heroes SET publisher = 'The Bionic Woman'         WHERE publisher = 'Company-Licensed' AND comicvine_id = '55306';
UPDATE heroes SET publisher = 'Buffy the Vampire Slayer' WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY['20096','20094']);
UPDATE heroes SET publisher = 'The Chronicles of Narnia' WHERE publisher = 'Company-Licensed' AND comicvine_id = '4750';
UPDATE heroes SET publisher = 'Jurassic Park'            WHERE publisher = 'Company-Licensed' AND comicvine_id = '4228';
UPDATE heroes SET publisher = 'Mission: Impossible'      WHERE publisher = 'Company-Licensed' AND comicvine_id = '163458';
UPDATE heroes SET publisher = 'Kool-Aid'                 WHERE publisher = 'Company-Licensed' AND comicvine_id = '43909';
UPDATE heroes SET publisher = 'Woody Woodpecker'         WHERE publisher = 'Company-Licensed' AND comicvine_id = '1946';
UPDATE heroes SET publisher = 'Radical Entertainment'    WHERE publisher = 'Company-Licensed' AND comicvine_id = '58219'; -- Prototype
