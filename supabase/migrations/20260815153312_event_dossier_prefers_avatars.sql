-- Same face change as the hub and edition pages, on the live dossier: prefer the
-- flat head-icon over the portrait. See event_pages_prefer_avatars_and_respect_affinity
-- for the reasoning — at 30-56pt a portrait is a smear and the face is the part
-- being recognised. Both lists here are already fame-gated, which is why the
-- 98.7% avatar coverage above fame 40 makes this a default rather than an option.

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
  revealed as (
    select jsonb_agg(x order by (x->>'fame_score')::int desc nulls last) as j
    from (
      select distinct on (h.id) jsonb_build_object(
        'hero_id', h.id, 'name', h.name, 'publisher', h.publisher,
        'portrait_url', coalesce(h.avatar_url, h.portrait_url, h.image_url),
        'fame_score', h.fame_score,
        'title_id', cv.title_id, 'title_name', t.title
      ) as x
      from ev, public.channel_videos cv
      join public.media_channels ch on ch.id = cv.channel_id
      cross join lateral unnest(coalesce(cv.cast_hero_ids, '{}')) as hid
      join public.heroes h on h.id = hid
      left join public.titles t on t.id = cv.title_id
      where cv.published_at::date between ev.win_from - 1 and ev.win_to
        and (ev.channel_slugs is null or ch.slug = any (ev.channel_slugs))
      order by h.id, ch.official desc, cv.published_at desc
      limit 18
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
                       where a.title_id = t.id
                         and (h.avatar_url is not null or h.portrait_url is not null or h.image_url is not null))
      ) as x
      from ev, public.title_videos v
      join public.titles t on t.id = v.title_id
      where v.published_at is not null and v.type in ('Trailer','Teaser')
        and coalesce(v.official, true)
        and v.published_at::date between ev.win_from and ev.win_to
        and coalesce(t.poster_url, t.backdrop_url) is not null
        and (
          ev.channel_slugs is null and ev.publishers is null
          -- by channel: the studio's own upload
          or exists (
            select 1 from public.channel_videos cv2
            join public.media_channels ch2 on ch2.id = cv2.channel_id
            where cv2.id = v.key
              and ev.channel_slugs is not null
              and ch2.slug = any (ev.channel_slugs)
          )
          -- by cast: the catalogue ties the title to the event's publishers
          or exists (
            select 1 from public.hero_media_appearances a2
            join public.heroes h2 on h2.id = a2.hero_id
            where a2.title_id = t.id
              and ev.publishers is not null
              and h2.publisher = any (ev.publishers)
          )
        )
      order by t.id, v.published_at desc
    ) s
  ),
  surges as (
    select jsonb_agg(x order by (x->>'weight')::numeric desc) as j
    from (
      select jsonb_build_object(
        'hero_id', h.id, 'name', h.name, 'publisher', h.publisher,
        'portrait_url', coalesce(h.avatar_url, h.portrait_url, h.image_url),
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
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'slug', ev.slug, 'headline', ev.headline, 'blurb', ev.blurb, 'accent', ev.accent,
      'live_from', ev.live_from, 'live_to', ev.live_to, 'ongoing', ev.ongoing,
      'shape', ev.shape, 'spike_ratio', ev.spike_ratio, 'baseline', ev.baseline,
      'peak', ev.peak, 'edits_recent', ev.edits_recent, 'views_daily', ev.views_daily,
      'first_detected_at', ev.first_detected_at),
    'announcements', coalesce((select j from announcements), '[]'::jsonb),
    'revealed', coalesce((select j from revealed), '[]'::jsonb),
    'trailers', coalesce((select j from trailers), '[]'::jsonb),
    'surges', coalesce((select j from surges), '[]'::jsonb)
  ) from ev;
$function$;
