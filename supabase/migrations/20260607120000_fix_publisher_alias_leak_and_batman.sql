-- Data corrections for two SuperheroAPI ingestion bugs.
--
-- Bug A — Batman mislabel: the row with all of Bruce Wayne's ComicVine
-- enrichment (cv 1699, 24,975 issues, "Bruce Wayne…" bio) was labelled
-- full_name "Terry McGinnis", while a thin duplicate held the Bruce label with
-- no data. Relabel the enriched row as Bruce, and repurpose the empty duplicate
-- as Batman Beyond (Terry) so all three Batmen are distinct and correct.
UPDATE heroes SET full_name = 'Bruce Wayne' WHERE id = '69';
UPDATE heroes SET name = 'Batman Beyond', full_name = 'Terry McGinnis' WHERE id = '70';

-- Bug B — alias leaked into publisher: for these rows `publisher` was populated
-- with one of the character's own alter-ego names instead of the publisher
-- (e.g. Nightwing → "Batman II", Deadpool → "Evil Deadpool"). Every affected
-- row is a well-known DC or Marvel character. Legitimate non-comic source
-- labels (NBC - Heroes, Star Trek, SyFy, IDW, Rebellion, Titan, Sony) are left
-- untouched.
UPDATE heroes SET publisher = 'DC Comics'
WHERE id IN ('505','63','340','267','562','561','491','71','563','546','549',
             '266','68','613','334','454','265','644');

UPDATE heroes SET publisher = 'Marvel Comics'
WHERE id IN ('672','24','442','690','130','689','477','26','40','654','726',
             '687','247','213','379','517','590','34','157','568','416','361',
             '697','135','30','659','577','707','693');
