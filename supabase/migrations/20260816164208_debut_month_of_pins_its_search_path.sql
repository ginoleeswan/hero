-- Clears the one advisor warning the new work introduced. debut_month_of reads
-- no tables, so a mutable search_path cannot actually be exploited here, but a
-- function that is baked into an index expression is exactly the wrong place to
-- leave an unpinned resolution path — every row of heroes_debut_month_idx was
-- built by calling it.
--
-- ALTER rather than CREATE OR REPLACE deliberately: the index depends on this
-- function's identity, and replacing the body of an indexed expression is how
-- an index quietly stops agreeing with the table it indexes.
alter function public.debut_month_of(jsonb) set search_path = pg_catalog, public;
