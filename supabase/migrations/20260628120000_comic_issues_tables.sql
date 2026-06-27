-- Comic-issue freshness backbone. Sibling of titles / hero_media_appearances:
-- comic_issues is the ComicVine weekly slate, comic_issue_appearances is the
-- issue↔catalogue-character graph. Populated by the sync-new-comics edge fn;
-- read by get_new_comics. Both are public-read (anon Explore must see them).
create table if not exists public.comic_issues (
  id           text primary key,             -- 'cvi:<comicvine_issue_id>'
  comicvine_id text unique not null,         -- ComicVine issue id (as text)
  volume_name  text,                         -- series name, e.g. "Batman"
  volume_id    integer,                      -- ComicVine volume id (future grouping)
  issue_number text,                         -- ComicVine sends strings ("1", "1.MU")
  cover_url    text,                         -- image.original_url / super / medium
  store_date   date,                         -- on-sale date — the freshness key
  cover_date   date,                         -- masthead date (reused by On This Day)
  publisher    text,                         -- derived from the lead catalogue hero
  lead_hero_id text references public.heroes(id) on delete set null,
  max_fame     smallint,                     -- highest fame_score among its catalogue chars
  synced_at    timestamptz default now()
);

create table if not exists public.comic_issue_appearances (
  issue_id text not null references public.comic_issues(id) on delete cascade,
  hero_id  text not null references public.heroes(id) on delete cascade,
  primary key (issue_id, hero_id)
);

create index if not exists comic_issues_store_date_idx on public.comic_issues (store_date desc);
create index if not exists comic_issue_appearances_hero_idx on public.comic_issue_appearances (hero_id);

alter table public.comic_issues             enable row level security;
alter table public.comic_issue_appearances  enable row level security;
create policy "Public read access" on public.comic_issues
  for select to anon, authenticated using (true);
create policy "Public read access" on public.comic_issue_appearances
  for select to anon, authenticated using (true);
