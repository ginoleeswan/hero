-- get_top_rivalries filters hero_relationships on (kind='enemy' AND source='curated'),
-- which no index covered — so every call seq-scanned ~194k rows to find ~30 curated
-- pairs (~2.3s), blowing the PostgREST statement timeout and 500'ing the home page's
-- "Greatest Rivalries" row. A partial covering index over just the curated-enemy rows
-- makes the lookup an index-only scan (the partition is tiny).
create index if not exists hero_relationships_curated_enemy
  on public.hero_relationships (hero_id, related_id, cross_universe)
  where kind = 'enemy' and source = 'curated';
