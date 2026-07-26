-- get_pulse_candidates gains the event window, so the live card can count days.
--
-- "Happening now" is true but static; "DAY 4 OF 4" is what makes a live card read
-- as live rather than merely labelled — progress through a window is the thing a
-- reader checks. That needs live_from/live_to, which the reader wasn't returning.
--
-- Named generically (window_from / window_to) rather than live_from / live_to
-- because the other kinds have windows too and may want them later — an issue's
-- on-sale week, a title's release. Null for every kind but live_event today.
--
-- Reissues the whole function: everything below the two new columns is unchanged
-- from 20260726220000_pulse_candidates.sql.

create or replace function public.get_pulse_candidates(p_per_kind integer default 20)
returns table (
  kind text,
  event_id text,
  entity_id text,
  headline text,
  subtype text,
  image_url text,
  accent text,
  occurred_at timestamptz,
  media_key text,
  release_date date,
  provider text,
  publisher text,
  character_count integer,
  max_fame smallint,
  -- The event's own window. Live events only, for now.
  window_from date,
  window_to date
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
      coalesce(w.first_detected_at, le.live_from::timestamptz) as occurred_at,
      null::text as media_key,
      null::date as release_date,
      null::text as provider,
      null::text as publisher,
      0 as character_count,
      null::smallint as max_fame,
      le.live_from as window_from,
      le.live_to as window_to
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
      and coalesce(v.official, true)
  ),
  trailer_top as (
    select * from trailer_rows where vrank = 1 order by published_at desc limit p_per_kind
  ),
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
      tc.character_count, tc.max_fame,
      null::date, null::date
    from trailer_top tt
    join public.titles t on t.id = tt.title_id
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
      coalesce(ic.character_count, 0), it.max_fame,
      null::date, null::date
    from issue_top it
    left join issue_cast ic on ic.issue_id = it.id
  )
  select * from live
  union all select * from trailers
  union all select * from issues;
$$;
grant execute on function public.get_pulse_candidates(integer)
  to anon, authenticated, service_role;
