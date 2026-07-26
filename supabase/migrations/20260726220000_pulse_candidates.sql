-- get_pulse_candidates — the raw material for the "Pulse" rail: one union of
-- everything the catalogue knows that HAPPENED, each carrying a real timestamp.
--
-- Deliberately does NO scoring and NO copy. It selects recent candidates per kind
-- by an indexed recency scan and returns facts; the decay/weight model and every
-- user-facing string live in src/lib/home/pulse.ts, where they're unit-testable.
-- Putting the ranking in SQL would have made the interesting part the one part
-- with no tests.
--
-- Three kinds, because three are all that currently have an honest event time:
--
--   live_event  — watched_events, via get_live_events() so the window predicate
--                 isn't duplicated (and can't drift from it).
--   trailer     — title_videos.published_at.
--   issue       — comic_issues.store_date.
--
-- Two more from the design doc are NOT here on purpose:
--   * streaming debut — would need a watch_providers *delta*, and no provider
--     history is kept, so "landed on Disney+ Tuesday" isn't knowable yet.
--   * pageview surge — heroes.pageviews_spike is week-over-week with no event
--     time; pageviews_at is when *we looked*, not when it happened. Needs the
--     daily series from design doc §3.2 first. An undated row in a timestamped
--     feed would undermine the whole premise, so surges stay in Trending Movers.

create or replace function public.get_pulse_candidates(p_per_kind integer default 20)
returns table (
  -- 'live_event' | 'trailer' | 'issue'
  kind text,
  -- Stable, kind-prefixed. React keys and client-side dedupe.
  event_id text,
  -- What to route to: title id, issue id, or event slug.
  entity_id text,
  headline text,
  -- Trailer/Teaser for trailers; issue number for issues; shape for events.
  subtype text,
  image_url text,
  accent text,
  occurred_at timestamptz,
  -- YouTube key for trailers, so the card can offer a play affordance.
  media_key text,
  -- Facts the client composes its "so what" line from — never a prebuilt string.
  release_date date,
  provider text,
  publisher text,
  character_count integer,
  max_fame smallint
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select
      'live_event'::text as kind,
      'event:' || le.slug as event_id,
      le.slug as entity_id,
      le.headline,
      le.shape as subtype,
      null::text as image_url,
      le.accent,
      -- When we first detected it, else the inferred window start.
      coalesce(w.first_detected_at, le.live_from::timestamptz) as occurred_at,
      null::text as media_key,
      null::date as release_date,
      null::text as provider,
      null::text as publisher,
      0 as character_count,
      null::smallint as max_fame
    from public.get_live_events() le
    join public.watched_events w on w.slug = le.slug
  ),
  trailer_rows as (
    select v.title_id, v.key, v.type, v.published_at,
           row_number() over (partition by v.title_id order by v.published_at desc) as vrank
    from public.title_videos v
    where v.published_at is not null
      and v.published_at > now() - interval '14 days'
      and v.type in ('Trailer', 'Teaser')
      -- `official` is a nullable documented-only field; unknown counts as ok so a
      -- missing flag can never empty the rail.
      and coalesce(v.official, true)
  ),
  trailer_top as (
    select * from trailer_rows where vrank = 1 order by published_at desc limit p_per_kind
  ),
  -- Restricted to the candidates. Grouping hero_media_appearances wholesale would
  -- be a full scan on every refresh.
  trailer_cast as (
    select a.title_id,
           count(*)::integer as character_count,
           max(h.fame_score) as max_fame
    from public.hero_media_appearances a
    join public.heroes h on h.id = a.hero_id
    where a.title_id in (select title_id from trailer_top)
      and (h.portrait_url is not null or h.image_url is not null)
    group by a.title_id
  ),
  trailers as (
    select
      'trailer'::text, 'video:' || tt.key, t.id, t.title, tt.type,
      coalesce(t.backdrop_url, t.poster_url), null::text, tt.published_at, tt.key,
      t.release_date,
      (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}')::text,
      null::text,
      tc.character_count, tc.max_fame
    from trailer_top tt
    join public.titles t on t.id = tt.title_id
    -- Inner join: an event we can't illustrate with catalogue characters isn't an
    -- event this app should report.
    join trailer_cast tc on tc.title_id = tt.title_id
  ),
  issue_top as (
    select i.id, i.volume_name, i.issue_number, i.cover_url, i.store_date,
           i.publisher, i.max_fame
    from public.comic_issues i
    where i.store_date is not null
      and i.store_date > current_date - 14
      and i.store_date <= current_date
      and i.cover_url is not null
      and coalesce(i.max_fame, 0) >= 25
    order by i.store_date desc, i.max_fame desc nulls last
    limit p_per_kind
  ),
  issue_cast as (
    select a.issue_id, count(*)::integer as character_count
    from public.comic_issue_appearances a
    join public.heroes h on h.id = a.hero_id
    where a.issue_id in (select id from issue_top)
      and (h.portrait_url is not null or h.image_url is not null)
    group by a.issue_id
  ),
  issues as (
    select
      'issue'::text, 'issue:' || it.id, it.id, it.volume_name, it.issue_number,
      it.cover_url, null::text, it.store_date::timestamptz, null::text,
      null::date, null::text, it.publisher,
      coalesce(ic.character_count, 0), it.max_fame
    from issue_top it
    left join issue_cast ic on ic.issue_id = it.id
  )
  select * from live
  union all select * from trailers
  union all select * from issues;
$$;
grant execute on function public.get_pulse_candidates(integer)
  to anon, authenticated, service_role;
