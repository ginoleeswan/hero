-- Resolve the Star Wars Expanded-Universe tail of the "Company-Licensed" bucket.
--
-- After 20260624120000 re-branded the non-Star-Wars franchises, 413 rows
-- remained — almost entirely obscure Star Wars EU characters (Dark Horse's
-- decades-long SW line). Verification, per the agreed ComicVine/Wikidata pass:
--
--   * 260 rows were confirmed Star Wars by their OWN stored bio text mentioning
--     SW canon (jedi/sith/lightsaber/tatooine/wookiee/clone wars/… — matched in
--     summary/description/first_appearance/group_affiliation/origin). A non-SW
--     character cannot carry those terms, so this is collision-proof.
--   * The remaining ~150 text-sparse rows were reviewed by name one-by-one. The
--     only non-Star-Wars or genuinely-ambiguous entries in the entire bucket are
--     the 38 comicvine_ids excluded below (real other franchises like Joe
--     Palooka / Ellery Queen / Tom Corbett / Rom, plus a handful of one-word or
--     low-confidence names left untouched rather than mis-filed).
--
-- Therefore: everything still in the bucket EXCEPT that exclusion set is Star
-- Wars. Conservative by design — a few of the excluded (e.g. Krayn, Kozorr,
-- Rathenn) are in fact SW but are left as 'Company-Licensed' rather than risk
-- sweeping in a non-SW row. 'Star Wars' is an existing PUBLISHER_BRANDS entry.

UPDATE heroes
SET publisher = 'Star Wars'
WHERE publisher = 'Company-Licensed'
  AND comicvine_id NOT IN (
    -- Non-Star-Wars franchises / characters:
    '2189',   -- Rom (ROM: Spaceknight)
    '2408',   -- Henry Aldrich
    '2409',   -- Homer Brown
    '2440',   -- Ellery Queen
    '2459',   -- Homer
    '2718',   -- Loopy Luke
    '2719',   -- Ceorl (Robert E. Howard / Conan)
    '2862',   -- Charlotte
    '2863',   -- Heavy D!
    '2937',   -- Howdy Doody
    '2976',   -- Tubby (Little Lulu)
    '3096',   -- Doctor Kent
    '3654',   -- Zed
    '3810',   -- Nameless
    '3813',   -- Sinclair
    '3817',   -- Sarin Virgilio
    '3818',   -- Craw
    '3819',   -- Hardin
    '3827',   -- Krayn (ambiguous; actually SW but left to be safe)
    '3828',   -- Zorneth (ambiguous)
    '4214',   -- Tom Corbett (Space Cadet)
    '4220',   -- Joe Palooka
    '4369',   -- Golgotha
    '4523',   -- Dexter Hall
    '4524',   -- Racine
    '4525',   -- Kozorr (ambiguous; likely SW, left to be safe)
    '4527',   -- Rathenn (ambiguous; likely SW, left to be safe)
    '4894',   -- Thunderbolt (Charlton/AC)
    '4978',   -- Bernard Chang (a comic artist mis-imported as a character)
    '7287',   -- Walrus
    '7594',   -- Leader
    '72519',  -- Mira (ambiguous one-word name)
    '89543',  -- Tatsu (TMNT / other)
    '118718', -- Fox Mother
    '134197', -- Elid (likely The Witcher — sits beside Yennefer's id)
    '166589', -- The Plumber
    '188825', -- The Ronin (ambiguous)
    '192449'  -- Atticus Cale
  );
