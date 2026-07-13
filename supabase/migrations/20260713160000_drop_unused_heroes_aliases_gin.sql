-- Drop the never-used aliases trigram GIN index on heroes.
--
-- The performance advisor flags heroes_aliases_trgm_idx as unused (idx_scan = 0
-- since stats reset) and it's redundant: alias text is already folded into the
-- heroes.search_text column, which has its own trigram index
-- (heroes_search_text_trgm_idx) that search actually uses. Keeping a second GIN
-- index on aliases costs ~4 MB of the (near-cap) free-tier disk AND — because
-- GIN maintenance runs on every write — adds write-IO on heroes, the hottest
-- table in the app (constant enrichment PATCHes). Dropping it helps both the
-- disk quota and the disk-IO budget.
--
-- Reversible:
--   create index heroes_aliases_trgm_idx on public.heroes
--     using gin (heroes_aliases_text(aliases) gin_trgm_ops);

drop index if exists public.heroes_aliases_trgm_idx;
