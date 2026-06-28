-- Daily TMDB "trending now" rank, stamped on the titles we already sync. A title
-- is in the trending set while trending_rank is non-null; the sync rewrites it
-- each day (the rank = position in TMDB's /trending/all/day list).
alter table public.titles add column if not exists trending_rank smallint;
alter table public.titles add column if not exists trending_at timestamptz;
create index if not exists titles_trending_rank_idx
  on public.titles (trending_rank) where trending_rank is not null;
