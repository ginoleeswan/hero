-- Canonicalize the last "George Lucas" stragglers onto "Star Wars".
--
-- A handful of original-SuperheroAPI Star Wars characters (Greedo, etc.) kept
-- the raw publisher "George Lucas", while the bulk were branded "Star Wars" by
-- the Company-Licensed re-brand. That split showed up in search/SEO (Greedo →
-- "George Lucas", Han Solo → "Star Wars"). Fold them together so every Star
-- Wars character reads "Star Wars" everywhere. The star-wars brand still matches
-- 'george lucas' defensively, but its browse query is now 'star wars'.

UPDATE heroes SET publisher = 'Star Wars' WHERE publisher = 'George Lucas';
