-- Lever 1 of the "even faster" pass. With RLS gone from the catalog
-- (20260715105126), ILIKE predicates can finally use trigram indexes as index
-- quals. These cover the browse surfaces' hot filters:
--   publisher  — every /universe page + the marvel/dc/image/dark-horse
--                category predicates. Big publishers already ride the
--                fame-index walk (~130ms); the GIN path caps the TAIL — small
--                publishers no longer walk the whole fame index (dark horse:
--                5.2ms as anon, verified).
--   name/full_name — the in-grid search box (name.ilike.%q% or
--                full_name.ilike.%q%), previously a full scan per keystroke.
create extension if not exists pg_trgm;

create index if not exists heroes_publisher_trgm
  on public.heroes using gin (publisher gin_trgm_ops);

create index if not exists heroes_name_trgm
  on public.heroes using gin (name gin_trgm_ops);

create index if not exists heroes_full_name_trgm
  on public.heroes using gin (full_name gin_trgm_ops);
