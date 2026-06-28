-- Wikipedia attention signal. enwiki_title is backfilled from wikidata_qid
-- ('' sentinel = no English article, so it isn't retried). The pageview columns
-- are refreshed by the sync-wiki-pageviews drain; spike = (week+1)/(prev+1) drives
-- the "trending this week" ranking.
alter table public.heroes add column if not exists enwiki_title text;
alter table public.heroes add column if not exists pageviews_week integer;
alter table public.heroes add column if not exists pageviews_prev integer;
alter table public.heroes add column if not exists pageviews_spike numeric;
alter table public.heroes add column if not exists pageviews_at timestamptz;
create index if not exists heroes_pageviews_spike_idx
  on public.heroes (pageviews_spike desc) where pageviews_week is not null;
