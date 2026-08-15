-- The event PAGES follow the rail through the inverted gate.
--
-- 20260815080000 turned approval into a veto for `get_live_events`, which is
-- what the Pulse rail reads. It did not touch the other two readers of the same
-- flag, so the gate was left half-inverted:
--
--   get_live_events      approval <> 'rejected'   (rail: publishes)
--   get_event_dossier    approval =  'approved'   (page: 404s)
--   get_event_index      approval =  'approved'   (index: omits)
--
-- The rail card is tappable — `onEventPress` routes to /event/[slug] — so the
-- half-inversion shipped a live D23 card pointing at a dossier that returned
-- null. A card that publishes itself and then leads nowhere is worse than no
-- card: the rail is the app's claim that something is happening, and the page is
-- where that claim is meant to be paid off.
--
-- The lesson for the next person: `approval` is read in three places, and any
-- change to what it means has to move all three together. There is no shared
-- predicate to edit — inlining the same `where` in three functions is what
-- allowed one to drift. If a fourth reader appears, factor it out.
--
-- `admin_list_watched_events` and the two admin setters deliberately do NOT
-- filter: they exist to show the whole table, rejections included.

create or replace function public.get_event_dossier(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with ev as (
    select w.*, w.live_from as win_from,
           (coalesce(w.live_to, w.live_from) + (case when w.ongoing then 3 else 1 end)) as win_to
    from public.watched_events w
    where w.slug = p_slug and w.enabled and w.approval <> 'rejected' and w.live_from is not null
  ),
  trailers as (
    -- Ordered by how well the catalogue can illustrate it, not by clock. A page
    -- led by a title with no characters we hold is a page about someone else's
    -- news; recency alone put a Kamen Rider film above Avengers: Doomsday.
    select jsonb_agg(x order by (x->>'cast_count')::int desc, x->>'published_at' desc) as j
    from (
      select distinct on (t.id) jsonb_build_object(
        'title_id', t.id, 'title', t.title, 'poster_url', t.poster_url,
        'backdrop_url', t.backdrop_url, 'release_date', t.release_date,
        'video_key', v.key, 'video_type', v.type, 'published_at', v.published_at,
        'cast_count', (
          select count(*) from public.hero_media_appearances a
          join public.heroes h on h.id = a.hero_id
          where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null)
        )
      ) as x
      from ev, public.title_videos v
      join public.titles t on t.id = v.title_id
      where v.published_at is not null and v.type in ('Trailer','Teaser')
        and coalesce(v.official, true)
        and v.published_at::date between ev.win_from and ev.win_to
      order by t.id, v.published_at desc
    ) s
  ),
  surges as (
    -- Same face rule as the rail: recognisability x loudness. Raw spike favours
    -- obscure characters with tiny baselines and led this page with a fame-6
    -- character over Doctor Doom.
    select jsonb_agg(x order by (x->>'weight')::numeric desc) as j
    from (
      select jsonb_build_object(
        'hero_id', h.id, 'name', h.name, 'publisher', h.publisher,
        'portrait_url', coalesce(h.portrait_url, h.image_url),
        'spike', round(h.pageviews_spike, 1), 'pageviews_week', h.pageviews_week,
        'started', st.started, 'cause_kind', att.cause_kind, 'cause_label', att.cause_label,
        'weight', round(public.pulse_face_weight(h.fame_score, h.pageviews_spike), 1)
      ) as x
      from ev, public.heroes h
      cross join lateral (select public.surge_started_at(h.views_daily) as started) st
      left join lateral public.attribute_surge(h.id, st.started) att on true
      where h.views_daily is not null and h.pageviews_spike >= 2.5
        and h.pageviews_week >= 1500 and h.publisher is not null
        and h.publisher not in ('In the Public Domain','Non-Fictional')
        and (h.portrait_url is not null or h.image_url is not null)
        and st.started between ev.win_from and ev.win_to
      limit 24
    ) s
  ),
  issues as (
    -- "The comics that shipped that week", not "inside the event window".
    -- Comics ship on a Wednesday; SDCC runs Thursday to Sunday, so the event
    -- window alone returned nothing at all.
    select jsonb_agg(x order by x->>'store_date' desc) as j
    from (
      select jsonb_build_object(
        'id', i.id, 'volume_name', i.volume_name, 'issue_number', i.issue_number,
        'cover_url', i.cover_url, 'publisher', i.publisher, 'store_date', i.store_date
      ) as x
      from ev, public.comic_issues i
      where i.store_date between ev.win_from - 4 and ev.win_to
        and i.cover_url is not null and coalesce(i.max_fame, 0) >= 25
      order by i.store_date desc, i.max_fame desc nulls last
      limit 18
    ) s
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'slug', ev.slug, 'headline', ev.headline, 'blurb', ev.blurb, 'accent', ev.accent,
      'live_from', ev.live_from, 'live_to', ev.live_to, 'ongoing', ev.ongoing,
      'shape', ev.shape, 'spike_ratio', ev.spike_ratio, 'baseline', ev.baseline,
      'peak', ev.peak, 'edits_recent', ev.edits_recent, 'views_daily', ev.views_daily,
      'first_detected_at', ev.first_detected_at
    ),
    'trailers', coalesce((select j from trailers), '[]'::jsonb),
    'surges', coalesce((select j from surges), '[]'::jsonb),
    'issues', coalesce((select j from issues), '[]'::jsonb)
  )
  from ev;
$function$;

create or replace function public.get_event_index()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with live_now as (select slug from public.get_live_events()),
  caught as (
    select jsonb_build_object(
      'slug', w.slug, 'headline', w.headline, 'accent', w.accent,
      'live_from', w.live_from, 'live_to', w.live_to, 'ongoing', w.ongoing,
      'spike_ratio', w.spike_ratio, 'peak', w.peak,
      'is_live', (w.slug in (select slug from live_now)),
      'views_daily', w.views_daily
    ) as x, w.live_from as sort_from
    from public.watched_events w
    where w.enabled and w.approval <> 'rejected' and w.live_from is not null
  ),
  -- Everything polled that has NOT earned a page. Returned so the index can
  -- show the shape of the thing: an index with one row and no context reads as
  -- broken, and "we are also watching these nineteen" is both true and the most
  -- interesting thing a returning visitor can be told. Stays the exact
  -- complement of `caught`, so a rejected event is listed as watched rather than
  -- vanishing from both halves.
  watching as (
    select jsonb_build_object('slug', w.slug, 'headline', w.headline) as x, w.headline as sort_name
    from public.watched_events w
    where w.enabled
      and not (w.approval <> 'rejected' and w.live_from is not null)
  )
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(x order by sort_from desc) from caught), '[]'::jsonb),
    'watching', coalesce((select jsonb_agg(x order by sort_name) from watching), '[]'::jsonb),
    'watched', (select count(*) from public.watched_events where enabled)
  );
$function$;
