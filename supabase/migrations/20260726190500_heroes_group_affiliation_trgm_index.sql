-- The xmen slug matches `group_affiliation ILIKE '%x-men%'`, which meant a scan
-- of all 50k heroes — 2.3s warm, and it tipped over the anon 3s timeout once
-- the other slugs got faster. Only 470 rows have a group_affiliation at all, so
-- a partial trigram index over just those is tiny and serves the ILIKE
-- directly. It also covers the /category/xmen grid query, which runs the same
-- pattern through PostgREST. Measured anon round trip after: 3.4s/500 → 0.33s.
create index if not exists heroes_group_affiliation_trgm_idx
  on public.heroes using gin (group_affiliation gin_trgm_ops)
  where group_affiliation is not null;
