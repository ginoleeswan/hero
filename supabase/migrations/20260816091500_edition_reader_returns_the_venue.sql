-- get_event_edition returns where it happened.
--
-- Four new keys on the `event` object, read straight off the columns added in
-- 20260816090000. Everything else in this function is unchanged — it is restated
-- in full only because CREATE OR REPLACE has no other mode.
--
-- Read from the EDITION row rather than recomputed, unlike the trailers and
-- announcements below it: a venue is a fact about a day that has already
-- happened, and it is the one thing on this page that cannot improve later.

create or replace function public.get_event_edition(p_slug text, p_edition text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with e as (
    select * from public.event_editions
    where slug = p_slug and edition_slug = p_edition
  ),
  ev as (select w.channel_slugs, w.publishers from public.watched_events w, e where w.slug = e.slug),
  win as (select (live_from - 1) as f, (live_to + 3) as t from e),
  announcements as (
    select jsonb_agg(x order by x->>'published_at' desc) as j
    from (
      select jsonb_build_object(
        'video_id', cv.id, 'title', cv.title, 'published_at', cv.published_at,
        'thumbnail_url', cv.thumbnail_url, 'channel', ch.name, 'official', ch.official,
        'title_id', cv.title_id, 'title_name', t.title, 'poster_url', t.poster_url
      ) as x
      from win, ev, public.channel_videos cv
      join public.media_channels ch on ch.id = cv.channel_id
      left join public.titles t on t.id = cv.title_id
      where cv.published_at::date between win.f and win.t
        and cv.title_id is not null
        and (ev.channel_slugs is null or ch.slug = any (ev.channel_slugs))
      order by ch.official desc, cv.published_at desc
      limit 40
    ) s
  ),
  trailers as (
    select jsonb_agg(x order by (x->>'cast_count')::int desc, x->>'published_at' desc) as j
    from (
      select distinct on (t.id) jsonb_build_object(
        'title_id', t.id, 'title', t.title, 'poster_url', t.poster_url,
        'backdrop_url', t.backdrop_url, 'release_date', t.release_date,
        'video_key', v.key, 'video_type', v.type, 'published_at', v.published_at,
        'cast_count', (
          select count(*) from public.hero_media_appearances a
          join public.heroes h on h.id = a.hero_id
          where a.title_id = t.id
            and coalesce(h.avatar_url, h.portrait_url, h.image_url) is not null
        ),
        'cast', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'hero_id', c.id, 'name', c.name,
                   'portrait_url', coalesce(c.avatar_url, c.portrait_url, c.image_url),
                   'avatar', (c.avatar_url is not null)
                 ) order by c.fame_score desc nulls last), '[]'::jsonb)
          from (
            select h2.id, h2.name, h2.avatar_url, h2.portrait_url, h2.image_url, h2.fame_score
            from public.hero_media_appearances a2
            join public.heroes h2 on h2.id = a2.hero_id
            where a2.title_id = t.id
              and coalesce(h2.avatar_url, h2.portrait_url, h2.image_url) is not null
            order by h2.fame_score desc nulls last
            limit 6
          ) c
        )
      ) as x
      from win, ev, public.title_videos v
      join public.titles t on t.id = v.title_id
      where v.published_at is not null and v.type in ('Trailer','Teaser')
        and coalesce(v.official, true)
        and v.published_at::date between win.f and win.t
        and coalesce(t.poster_url, t.backdrop_url) is not null
        and (
          ev.channel_slugs is null and ev.publishers is null
          or exists (
            select 1 from public.channel_videos cv2
            join public.media_channels ch2 on ch2.id = cv2.channel_id
            where cv2.id = v.key and ev.channel_slugs is not null
              and ch2.slug = any (ev.channel_slugs)
          )
          or exists (
            select 1 from public.hero_media_appearances a2
            join public.heroes h2 on h2.id = a2.hero_id
            where a2.title_id = t.id and ev.publishers is not null
              and h2.publisher = any (ev.publishers)
          )
        )
      order by t.id, v.published_at desc
    ) s
  ),
  movers as (
    select coalesce(jsonb_agg(
             (f.v - 'portrait_url') || jsonb_build_object(
               'portrait_url', coalesce(h.avatar_url, h.portrait_url, h.image_url,
                                        f.v->>'portrait_url'),
               'avatar', (h.avatar_url is not null)
             ) order by f.ord), '[]'::jsonb) as j
    from e, jsonb_array_elements(e.surges) with ordinality f(v, ord)
    left join public.heroes h on h.id = f.v->>'hero_id'
  )
  select case when (select count(*) from e) = 0 then null else
    jsonb_build_object(
      'event', jsonb_build_object(
        'slug', (select slug from e), 'edition_slug', (select edition_slug from e),
        'headline', (select headline from e), 'accent', (select accent from e),
        'live_from', (select live_from from e), 'live_to', (select live_to from e),
        'shape', (select shape from e), 'spike_ratio', (select spike_ratio from e),
        'baseline', (select baseline from e), 'peak', (select peak from e),
        'edits_recent', (select edits_recent from e),
        'views_daily', (select views_daily from e),
        'recap', (select recap from e),
        'frozen_at', (select frozen_at from e),
        'venue', (select venue from e),
        'venue_city', (select venue_city from e),
        'venue_lat', (select venue_lat from e),
        'venue_lon', (select venue_lon from e)
      ),
      'movers',        coalesce((select j from movers), '[]'::jsonb),
      'announcements', coalesce((select j from announcements), '[]'::jsonb),
      'trailers',      coalesce((select j from trailers), '[]'::jsonb)
    )
  end;
$function$;
