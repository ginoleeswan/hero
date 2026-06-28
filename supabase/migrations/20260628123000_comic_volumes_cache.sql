-- Volume-roster cache for the weekly-comics ingest. ComicVine's /issues LIST
-- endpoint has no character_credits, and the per-issue DETAIL endpoint is harshly
-- rate-limited. So we attribute an issue's characters from its SERIES (volume)
-- roster, which we resolve ONCE per volume and cache here. Steady state: new
-- issues of a known series need zero ComicVine detail calls.
--
-- Service-role only (the sync-new-comics edge fn writes/reads it; the client never
-- touches it). RLS is enabled with no public policy — service role bypasses RLS,
-- anon/authenticated correctly see nothing.
create table if not exists public.comic_volumes (
  volume_id     integer primary key,                 -- ComicVine volume id
  name          text,
  publisher     text,
  character_ids text[] not null default '{}',        -- top catalogue hero ids, fame desc
  lead_hero_id  text references public.heroes(id) on delete set null,
  max_fame      smallint,
  status        text not null default 'resolved',    -- 'resolved' | 'no_catalogue'
  resolved_at   timestamptz default now()
);

alter table public.comic_volumes enable row level security;
