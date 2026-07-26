-- title_videos — persist the TMDB video list the pipeline already fetches.
--
-- Every title enrichment request has always carried `append_to_response=videos`,
-- and enrich-tmdb-batch parsed `d.videos.results` only to keep one field: the
-- YouTube key of the first trailer. Everything else was discarded, including
-- `published_at` — the only "a trailer just dropped" timestamp anywhere in the
-- stack. Confirmed by inspection of titles.details on 2026-07-26: it stores 17
-- other appended sections and no video metadata at all.
--
-- So this costs no additional API calls. It's the same data, kept.
--
-- A table rather than a `videos jsonb` column on titles, because the query that
-- matters is "event-worthy videos published in the last N hours, newest first,
-- across the whole catalogue". That's an indexed range scan here; against jsonb
-- it would be a full scan plus an unnest on every Explore load.

create table if not exists public.title_videos (
  -- TMDB's own video id. Stable, and distinct from `key` (the YouTube id).
  id text primary key,
  title_id text not null references public.titles(id) on delete cascade,
  key text not null,
  site text,
  -- Trailer / Teaser / Clip / Featurette / Behind the Scenes / Bloopers.
  type text,
  name text,
  official boolean,
  -- Null when TMDB omitted it or it didn't parse. The mapper counts these; a
  -- catalogue-wide count of zero dated rows would mean the documented field name
  -- is wrong (it has never been observed in this codebase — see the design doc
  -- §3.1), which is why nothing here is NOT NULL.
  published_at timestamptz,
  size integer,
  language text,
  first_seen_at timestamptz not null default now()
);

-- Round-robin cursor for the sweep below, mirroring heroes.pageviews_at. Kept on
-- titles rather than derived from title_videos, because "checked and found
-- nothing new" and "never checked" must be distinguishable — otherwise a title
-- with no videos gets re-fetched on every single run, forever.
alter table public.titles add column if not exists videos_checked_at timestamptz;

create index if not exists titles_videos_sweep_idx
  on public.titles (videos_checked_at asc nulls first)
  where media_type in ('film', 'tv');

-- The Pulse query: recent event-worthy videos, newest first. Partial so the
-- index stays small — most catalogue videos are old clips and featurettes.
create index if not exists title_videos_recent_idx
  on public.title_videos (published_at desc)
  where published_at is not null and type in ('Trailer', 'Teaser');

create index if not exists title_videos_title_idx
  on public.title_videos (title_id);

-- RLS on, no policies: reads go through the security-definer reader below, the
-- same posture as explore_bundle_cache and watched_events. The sync functions
-- write with the service role, which bypasses RLS.
alter table public.title_videos enable row level security;

-- ── reader ───────────────────────────────────────────────────────────────────
-- Trailers and teasers published inside the window, for titles that have
-- catalogue characters with art — an event we can't illustrate isn't an event.
-- One row per title (its newest qualifying video), so a title that dropped three
-- teasers in a day appears once.
create or replace function public.get_recent_trailers(
  p_hours integer default 72,
  p_limit integer default 12
)
returns table (
  title_id text,
  title text,
  media_type text,
  release_date date,
  poster_url text,
  backdrop_url text,
  video_key text,
  video_type text,
  video_name text,
  published_at timestamptz,
  character_count integer,
  max_fame smallint
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select v.title_id, v.key, v.type, v.name, v.published_at,
           row_number() over (
             partition by v.title_id order by v.published_at desc
           ) as vrank
    from public.title_videos v
    where v.published_at is not null
      and v.published_at > now() - make_interval(hours => p_hours)
      and v.type in ('Trailer', 'Teaser')
      -- `official` is nullable (documented-only field); treat unknown as
      -- acceptable so a missing flag never empties the rail.
      and coalesce(v.official, true)
  ),
  top as (
    select * from eligible where vrank = 1
  ),
  -- Restricted to the handful of titles in `top`. Grouping the whole
  -- hero_media_appearances table first would be a full scan on every Explore
  -- load — this DB has already had one statement_timeout incident from exactly
  -- that class of mistake (see 20260713140000_fix_refresh_tmdb_trending_cron).
  cast_counts as (
    select a.title_id,
           count(*)::integer as character_count,
           max(h.fame_score) as max_fame
    from public.hero_media_appearances a
    join public.heroes h on h.id = a.hero_id
    where a.title_id in (select title_id from top)
      and (h.portrait_url is not null or h.image_url is not null)
    group by a.title_id
  )
  select t.id, t.title, t.media_type, t.release_date, t.poster_url, t.backdrop_url,
         e.key, e.type, e.name, e.published_at,
         c.character_count, c.max_fame
  from top e
  join public.titles t on t.id = e.title_id
  join cast_counts c on c.title_id = t.id
  order by e.published_at desc
  limit p_limit;
$$;
grant execute on function public.get_recent_trailers(integer, integer)
  to anon, authenticated, service_role;

-- ── schedule ────────────────────────────────────────────────────────────────
-- A dedicated daily sweep, NOT a widening of refresh-tmdb-trending. That job
-- re-flips titles to enrich_status='pending' and only touches rows older than 14
-- days, so it can't catch a trailer on the day it lands, and driving it harder
-- would re-run the full heavy enrichment (credits, images, reviews) just to
-- re-read one array. /videos is a tiny endpoint; sweeping it separately is
-- cheaper and leaves enrichment state alone.
--
-- 06:40 UTC — before sync-tmdb-trending at 08:00 so the day's trailers are in
-- place when the trending ranks refresh, and clear of the 03:40-04:40 crunch.
-- To PAUSE: select cron.unschedule('sync-title-videos-daily');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-title-videos-daily',
  '40 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-title-videos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
