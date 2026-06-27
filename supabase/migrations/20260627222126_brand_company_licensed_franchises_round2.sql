-- Second pass re-branding the remaining "Company-Licensed" placeholder bucket onto
-- real franchises, by explicit comicvine_id (same safe pattern as the first pass).
-- These are mostly characters ingested after round 1 — e.g. the Sesame Street cast,
-- which ComicVine files under a "The Muppets" team but are a distinct franchise.
-- Re-branding also makes them eligible for fame scoring (Company-Licensed is excluded
-- from the popularity pool), so Cookie Monster et al can finally surface.

-- Sesame Street (ComicVine tags these "The Muppets"; the real Muppets are separate)
UPDATE heroes SET publisher = 'Sesame Street'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '113129','113126','164216','27503','32559','27504','113370','113770','196694',
  '65169','113939','113122','74973','113124','113942','113125','113127','190340',
  '35408','125079','180803','5451'
]);

-- Star Wars (Jedi/Sith/Rebel Alliance + Star Wars species: T'surr, Ithorian, Pantoran)
UPDATE heroes SET publisher = 'Star Wars'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '192449','3827','7594','72519','89543','188825','3828'
]);

-- Babylon 5 (Minbari / Psi Corps / Grey Council; Sinclair is the lead)
UPDATE heroes SET publisher = 'Babylon 5'
WHERE publisher = 'Company-Licensed' AND comicvine_id = ANY(ARRAY[
  '4523','4525','4524','4527','3813'
]);

-- Well-identified singletons / small franchises
UPDATE heroes SET publisher = 'SNK'                    WHERE publisher = 'Company-Licensed' AND comicvine_id = '3810'; -- King of Fighters
UPDATE heroes SET publisher = 'The Lord of the Rings'  WHERE publisher = 'Company-Licensed' AND comicvine_id = '2719'; -- Ceorl of Rohan
UPDATE heroes SET publisher = 'Spy Kids'               WHERE publisher = 'Company-Licensed' AND comicvine_id = '3096';
UPDATE heroes SET publisher = 'Death Race'             WHERE publisher = 'Company-Licensed' AND comicvine_id = '2718';
UPDATE heroes SET publisher = 'Ellery Queen'           WHERE publisher = 'Company-Licensed' AND comicvine_id = '2440';
UPDATE heroes SET publisher = 'Howdy Doody'            WHERE publisher = 'Company-Licensed' AND comicvine_id = '2937';
UPDATE heroes SET publisher = 'Joe Palooka'            WHERE publisher = 'Company-Licensed' AND comicvine_id = '4220';
UPDATE heroes SET publisher = 'Tom Corbett'            WHERE publisher = 'Company-Licensed' AND comicvine_id = '4214';
UPDATE heroes SET publisher = 'Little Lulu'            WHERE publisher = 'Company-Licensed' AND comicvine_id = '2976'; -- Tubby
UPDATE heroes SET publisher = 'Woody Woodpecker'       WHERE publisher = 'Company-Licensed' AND comicvine_id = '7287'; -- Wally Walrus
UPDATE heroes SET publisher = 'Mutant Chronicles'      WHERE publisher = 'Company-Licensed' AND comicvine_id = '4369'; -- Golgotha
UPDATE heroes SET publisher = 'CD Projekt Red'         WHERE publisher = 'Company-Licensed' AND comicvine_id = '118718'; -- Witcher (aguara)
UPDATE heroes SET publisher = 'Insomniac Games'        WHERE publisher = 'Company-Licensed' AND comicvine_id = '166589'; -- Ratchet & Clank
