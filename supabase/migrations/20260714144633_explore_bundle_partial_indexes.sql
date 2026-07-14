-- Speed up the hourly refresh_explore_bundle() (was ~17.6s cold). Its cost is
-- dominated by two direct heroes queries that heap-scan wide rows on a cold cache:
--   spotlight_famous: an index scan of powerstats_total>=200 (~8.4k rows) then a
--     heap filter down to the top 20 (cost ~5979).
--   newly_added: walks ~46k rows by added_at desc to find the newest 25 'cv-%'
--     (which are old, so the desc walk skips everything newer first).
-- Partial indexes matching each predicate return the top-N directly (spotlight_famous
-- cost 5979 -> 19; newly_added -> index-only scan). Worst-case bundle ~17.6s -> ~8.5s;
-- the rest is spread across ~13 small components (a background cache, users hit the
-- cached payload, so further micro-tuning has diminishing returns).
create index if not exists heroes_spotlight_famous_idx
  on public.heroes (movie_count desc nulls last, fame_score desc nulls last)
  where portrait_url is not null and summary is not null
    and movie_count >= 2 and powerstats_total >= 200;

create index if not exists heroes_newly_added_cv_idx
  on public.heroes (added_at desc)
  where id like 'cv-%' and publisher not in ('Non-Fictional', 'In the Public Domain');
