-- Canonicalize the two publisher labels that were split across ingestion paths.
--
-- The `publisher` column had two write paths that disagreed on the string:
--   * curated seed.sql + the alias-leak fix migration → full names
--     ("Marvel Comics", "DC Comics")
--   * bulk SuperheroAPI import → brand short names ("Marvel", "Image")
-- ComicVine enrichment never writes `publisher` (it writes the `ln` column),
-- so it is not a source of the split.
--
-- The user-facing surfaces resolve `publisher` through PUBLISHER_BRANDS
-- (src/constants/publishers.ts), whose display `name` is the short brand
-- ("Marvel", "Image"). Canonicalize the column onto that same short name so the
-- raw data matches what we display. The substring matchers still resolve
-- ("Marvel".includes('marvel') is true).
--
-- Only Marvel and Image were actually split. "DC Comics" (1,015 rows) and
-- "Dark Horse Comics" (8 rows) are already single-valued and left untouched.
-- "Marvel Comics and DC Comics" is an intentional cross-publisher label and is
-- deliberately NOT matched by the equality filter below.

UPDATE heroes SET publisher = 'Marvel' WHERE publisher = 'Marvel Comics';
UPDATE heroes SET publisher = 'Image'  WHERE publisher = 'Image Comics';
