-- A face has two possible shapes, and only the query knows which one it sent.
--
-- coalesce(avatar_url, portrait_url, image_url) collapses two different KINDS of
-- picture into one field. An avatar is a flat head-icon on a transparent ground
-- and must be drawn flat — no disc, no ring, no circular mask. A portrait is a
-- rectangular illustration and needs exactly those things: cropped to a circle
-- over a fill, the way it has always been drawn. Handed one field, the client
-- picked one treatment, and every fallback portrait rendered as a bare rectangle.
--
-- So the resolution stays here — the client should not repeat a three-way
-- coalesce in four components — but the answer now carries `avatar`, and the
-- shape is chosen from it.

create or replace function public.get_event_hub(p_slug text)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
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
             'recap', e.recap,
             'movers', jsonb_array_length(e.surges),
             'faces', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'hero_id', x.hero_id, 'name', x.name,
                        'portrait_url', x.face, 'avatar', x.is_avatar
                      ) order by x.ord), '[]'::jsonb)
               from (
                 select f.ord, f.v->>'hero_id' as hero_id,
                        coalesce(h.name, f.v->>'name') as name,
                        coalesce(h.avatar_url, h.portrait_url, h.image_url,
                                 f.v->>'portrait_url') as face,
                        h.avatar_url is not null as is_avatar
                 from jsonb_array_elements(e.surges) with ordinality f(v, ord)
                 left join public.heroes h on h.id = f.v->>'hero_id'
                 where coalesce(h.avatar_url, h.portrait_url, h.image_url,
                                f.v->>'portrait_url') is not null
                 order by f.ord
                 limit 3
               ) x
             ),
             'announcements', (
               select count(*) from public.channel_videos cv
               join public.media_channels ch on ch.id = cv.channel_id
               where cv.published_at::date between e.live_from - 1 and e.live_to + 3
                 and cv.title_id is not null
                 and (ev.channel_slugs is null or ch.slug = any (ev.channel_slugs))
             )
           ) order by e.live_from desc) as j
    from public.event_editions e, ev
    where e.slug = p_slug and e.suppressed_reason is null
  )
  select case when (select count(*) from ev) = 0 then null else
    jsonb_build_object(
      'slug', (select slug from ev), 'headline', (select headline from ev),
      'accent', (select accent from ev), 'blurb', (select blurb from ev),
      'enwiki_title', (select enwiki_title from ev),
      'is_live', (select count(*) > 0 from live_now),
      'live_from', (select live_from from ev), 'live_to', (select live_to from ev),
      'shape', (select shape from ev), 'spike_ratio', (select spike_ratio from ev),
      'best_spike', (select max(spike_ratio) from public.event_editions
                     where slug = p_slug and suppressed_reason is null),
      'editions', coalesce((select j from eds), '[]'::jsonb))
  end;
$function$;

create or replace function public.get_event_edition(p_slug text, p_edition text)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with e as (
    select * from public.event_editions
    where slug = p_slug and edition_slug = p_edition and suppressed_reason is null
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
          where a.title_id = t.id and (h.avatar_url is not null or h.portrait_url is not null or h.image_url is not null)
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
               'avatar', h.avatar_url is not null
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
        'frozen_at', (select frozen_at from e)
      ),
      'movers',        coalesce((select j from movers), '[]'::jsonb),
      'announcements', coalesce((select j from announcements), '[]'::jsonb),
      'trailers',      coalesce((select j from trailers), '[]'::jsonb)
    )
  end;
$function$;
