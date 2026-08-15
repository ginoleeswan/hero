-- The Pulse rail promises "right now" and delivered the archive.
--
-- Since the event IA settled on "/event/[slug] is always the hub", a live_event
-- card on Explore routed to a page whose subject is every edition since 2016.
-- The reader tapped a card that said something was happening NOW and landed on
-- a timeline, needing a second tap on "See what's dropping" to reach the thing
-- the card was about.
--
-- The rail could not do better, because a pulse row had no way to name the
-- edition: get_live_events() returns a slug and a window, not an edition_slug.
-- This joins the window back to the edition that owns it.
--
-- Matched on (slug, live_from) rather than "the newest edition": an event's rows
-- are not guaranteed to be in date order, and the live window IS the identity of
-- the edition being reported. It is also exactly what EventHub does on the
-- client to pick which edition its live CTA points at, so the two agree by
-- construction.
--
-- Nullable, and the client falls back to the hub when it is null: an event can
-- be detected live before its edition row is frozen, and a rail that 404s is
-- worse than one that lands a step early.
--
-- DROP then CREATE, not CREATE OR REPLACE: this adds a column to the returned
-- table, and Postgres will not let a replacement change a function's result
-- type. The grants are restated below because DROP takes them with it.

drop function if exists public.get_pulse_candidates(integer);

create function public.get_pulse_candidates(p_per_kind integer default 20)
returns table (
  kind text, event_id text, entity_id text, headline text, subtype text,
  image_url text, accent text, occurred_at timestamptz, media_key text,
  release_date date, provider text, publisher text, character_count integer,
  max_fame smallint, window_from date, window_to date,
  cause_kind text, cause_label text, cause_date date, cause_confidence text,
  edition_slug text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with live as (
    select 'live_event'::text as kind, 'event:' || le.slug as event_id, le.slug as entity_id,
      le.headline, le.shape as subtype, null::text as image_url, le.accent,
      coalesce(w.first_detected_at, le.live_from::timestamptz) as occurred_at,
      null::text as media_key, null::date as release_date, null::text as provider,
      null::text as publisher, 0 as character_count, null::smallint as max_fame,
      le.live_from as window_from, le.live_to as window_to,
      null::text as cause_kind, null::text as cause_label, null::date as cause_date,
      null::text as cause_confidence,
      ed.edition_slug
    from public.get_live_events() le
    join public.watched_events w on w.slug = le.slug
    left join public.event_editions ed
      on ed.slug = le.slug and ed.live_from = le.live_from
  ),
  trailer_rows as (
    select v.title_id, v.key, v.type, v.published_at,
           row_number() over (partition by v.title_id order by v.published_at desc) as vrank
    from public.title_videos v
    where v.published_at is not null and v.published_at > now() - interval '14 days'
      and v.type in ('Trailer','Teaser') and coalesce(v.official, true)
  ),
  trailer_top as (select * from trailer_rows where vrank = 1 order by published_at desc limit p_per_kind),
  trailer_cast as (
    select a.title_id, count(*)::integer as character_count, max(h.fame_score) as max_fame
    from public.hero_media_appearances a join public.heroes h on h.id = a.hero_id
    where a.title_id in (select title_id from trailer_top)
      and (h.portrait_url is not null or h.image_url is not null)
    group by a.title_id
  ),
  trailers as (
    select 'trailer'::text, 'video:' || tt.key, t.id, t.title, tt.type,
      coalesce(t.backdrop_url, t.poster_url), null::text, tt.published_at, tt.key,
      t.release_date, (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}')::text,
      null::text, tc.character_count, tc.max_fame, null::date, null::date,
      null::text, null::text, null::date, null::text, null::text
    from trailer_top tt join public.titles t on t.id = tt.title_id
    join trailer_cast tc on tc.title_id = tt.title_id
  ),
  surging as (
    select h.id, h.name, h.publisher, h.fame_score, h.pageviews_spike,
           coalesce(h.portrait_url, h.image_url) as art,
           public.surge_started_at(h.views_daily) as started
    from public.heroes h
    where h.views_daily is not null and h.pageviews_spike >= 2.5
      and h.pageviews_week >= 1500 and h.publisher is not null
      and h.publisher not in ('In the Public Domain','Non-Fictional')
      and (h.portrait_url is not null or h.image_url is not null)
  ),
  dated as (select * from surging where started is not null),
  grouped as (
    select publisher, count(*)::integer as members, max(pageviews_spike) as top_spike,
           max(fame_score) as max_fame, min(started) as started
    from dated group by publisher
  ),
  face as (
    select distinct on (d.publisher) d.publisher, d.id, d.name, d.art, d.started
    from dated d
    order by d.publisher, public.pulse_face_weight(d.fame_score, d.pageviews_spike) desc
  ),
  surges as (
    select 'surge'::text, 'surge:' || g.publisher, f.id, f.name,
      round(g.top_spike, 1)::text, f.art, null::text, g.started::timestamptz, null::text,
      null::date, null::text, g.publisher, g.members, g.max_fame, g.started, null::date,
      -- Attributed on the FACE, because the face is who the card names.
      att.cause_kind, att.cause_label, att.cause_date, att.confidence, null::text
    from grouped g
    join face f on f.publisher = g.publisher
    left join lateral public.attribute_surge(f.id, f.started) att on true
    order by g.top_spike desc limit p_per_kind
  ),
  issue_top as (
    select i.id, i.volume_name, i.issue_number, i.cover_url, i.store_date, i.publisher, i.max_fame
    from public.comic_issues i
    where i.store_date is not null and i.store_date > current_date - 14
      and i.store_date <= current_date and i.cover_url is not null
      and coalesce(i.max_fame, 0) >= 25
    order by i.store_date desc, i.max_fame desc nulls last limit p_per_kind
  ),
  issue_cast as (
    select a.issue_id, count(*)::integer as character_count
    from public.comic_issue_appearances a join public.heroes h on h.id = a.hero_id
    where a.issue_id in (select id from issue_top)
      and (h.portrait_url is not null or h.image_url is not null)
    group by a.issue_id
  ),
  issues as (
    select 'issue'::text, 'issue:' || it.id, it.id, it.volume_name, it.issue_number,
      it.cover_url, null::text, it.store_date::timestamptz, null::text,
      null::date, null::text, it.publisher, coalesce(ic.character_count, 0), it.max_fame,
      null::date, null::date, null::text, null::text, null::date, null::text, null::text
    from issue_top it left join issue_cast ic on ic.issue_id = it.id
  )
  select * from live
  union all select * from trailers
  union all select * from surges
  union all select * from issues;
$function$;

grant execute on function public.get_pulse_candidates(integer) to anon, authenticated, service_role;
