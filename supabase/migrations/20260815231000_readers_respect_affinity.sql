-- The readers apply event affinity, and drop art-less trailers.
--
-- 20260815230000 added channel_slugs/publishers to watched_events; this is where
-- they take effect. Three changes, all visible on the live D23 page:
--
--   * announcements are filtered to the event's own channels, so a Disney fan
--     event stops listing Crunchyroll, PlayStation and Nintendo uploads.
--   * surges are filtered to the event's own publishers, so "Who it moved" stops
--     answering "Pichu, Pikachu, Aunt Hilda Spellman".
--   * a trailer with no poster AND no backdrop is dropped rather than rendered,
--     because a freshly discovered title is a thin row with no art yet and the
--     card came out as a black rectangle.
--
-- NULL affinity means no filter, which is deliberate and correct for a general
-- convention: San Diego Comic-Con genuinely is where everyone announces.
--
-- The hub's per-edition count uses the SAME filter as the dossier list, so the
-- number on a hub row and the list on the page it links to cannot disagree —
-- they did, at 79 against 24.

-- get_event_dossier: announcements + surges respect affinity.
create or replace function public.get_event_dossier(p_slug text)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with ev as (
    select w.*, w.live_from as win_from,
           (coalesce(w.live_to, w.live_from) + (case when w.ongoing then 3 else 1 end)) as win_to
    from public.watched_events w
    where w.slug = p_slug and w.enabled and w.approval <> 'rejected' and w.live_from is not null
  ),
  announcements as (
    select jsonb_agg(x order by (x->>'official')::boolean desc, x->>'published_at' desc) as j
    from (
      select jsonb_build_object(
        'video_id', cv.id, 'title', cv.title, 'published_at', cv.published_at,
        'thumbnail_url', cv.thumbnail_url, 'channel', ch.name, 'official', ch.official,
        'title_id', cv.title_id, 'title_name', t.title, 'poster_url', t.poster_url
      ) as x
      from ev, public.channel_videos cv
      join public.media_channels ch on ch.id = cv.channel_id
      join public.titles t on t.id = cv.title_id
      where cv.published_at::date between ev.win_from - 1 and ev.win_to
        and (ev.channel_slugs is null or ch.slug = any (ev.channel_slugs))
      order by ch.official desc, cv.published_at desc
      limit 24
    ) s
  ),
  trailers as (
    select jsonb_agg(x order by (x->>'cast_count')::int desc, x->>'published_at' desc) as j
    from (
      select distinct on (t.id) jsonb_build_object(
        'title_id', t.id, 'title', t.title, 'poster_url', t.poster_url,
        'backdrop_url', t.backdrop_url, 'release_date', t.release_date,
        'video_key', v.key, 'video_type', v.type, 'published_at', v.published_at,
        'cast_count', (select count(*) from public.hero_media_appearances a
                       join public.heroes h on h.id = a.hero_id
                       where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null))
      ) as x
      from ev, public.title_videos v
      join public.titles t on t.id = v.title_id
      where v.published_at is not null and v.type in ('Trailer','Teaser')
        and coalesce(v.official, true)
        and v.published_at::date between ev.win_from and ev.win_to
        -- A trailer only counts if the catalogue can illustrate it. Art-less
        -- rows rendered as black rectangles on the live page.
        and coalesce(t.poster_url, t.backdrop_url) is not null
      order by t.id, v.published_at desc
    ) s
  ),
  surges as (
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
        and (ev.publishers is null or h.publisher = any (ev.publishers))
      limit 24
    ) s
  ),
  issues as (
    select jsonb_agg(x order by x->>'store_date' desc) as j
    from (
      select jsonb_build_object('id', i.id, 'volume_name', i.volume_name,
        'issue_number', i.issue_number, 'cover_url', i.cover_url,
        'publisher', i.publisher, 'store_date', i.store_date) as x
      from ev, public.comic_issues i
      where i.store_date between ev.win_from - 4 and ev.win_to
        and i.cover_url is not null and coalesce(i.max_fame, 0) >= 25
      order by i.store_date desc, i.max_fame desc nulls last limit 18
    ) s
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'slug', ev.slug, 'headline', ev.headline, 'blurb', ev.blurb, 'accent', ev.accent,
      'live_from', ev.live_from, 'live_to', ev.live_to, 'ongoing', ev.ongoing,
      'shape', ev.shape, 'spike_ratio', ev.spike_ratio, 'baseline', ev.baseline,
      'peak', ev.peak, 'edits_recent', ev.edits_recent, 'views_daily', ev.views_daily,
      'first_detected_at', ev.first_detected_at),
    'announcements', coalesce((select j from announcements), '[]'::jsonb),
    'trailers', coalesce((select j from trailers), '[]'::jsonb),
    'surges', coalesce((select j from surges), '[]'::jsonb),
    'issues', coalesce((select j from issues), '[]'::jsonb)
  ) from ev;
$function$;

-- get_event_hub: the per-edition announcement count uses the same filter, so the
-- number on the hub row matches the list on the page it links to.
create or replace function public.get_event_hub(p_slug text)
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  with ev as (
    select w.* from public.watched_events w
    where w.slug = p_slug and w.enabled and w.approval <> 'rejected'
  ),
  live_now as (select slug from public.get_live_events() where slug = p_slug),
  eds as (
    select jsonb_agg(jsonb_build_object(
             'edition_slug', e.edition_slug, 'headline', e.headline,
             'live_from', e.live_from, 'live_to', e.live_to,
             'spike_ratio', e.spike_ratio, 'peak', e.peak,
             'movers', jsonb_array_length(e.surges),
             'announcements', (
               select count(*) from public.channel_videos cv
               join public.media_channels ch on ch.id = cv.channel_id
               where cv.published_at::date between e.live_from - 1 and e.live_to + 3
                 and cv.title_id is not null
                 and ((select channel_slugs from ev) is null
                      or ch.slug = any ((select channel_slugs from ev)))
             )
           ) order by e.live_from desc) as j
    from public.event_editions e where e.slug = p_slug
  )
  select case when (select count(*) from ev) = 0 then null else
    jsonb_build_object(
      'slug', (select slug from ev), 'headline', (select headline from ev),
      'accent', (select accent from ev), 'blurb', (select blurb from ev),
      'enwiki_title', (select enwiki_title from ev),
      'is_live', (select count(*) > 0 from live_now),
      'live_from', (select live_from from ev), 'live_to', (select live_to from ev),
      'shape', (select shape from ev), 'spike_ratio', (select spike_ratio from ev),
      'editions', coalesce((select j from eds), '[]'::jsonb))
  end;
$$;
