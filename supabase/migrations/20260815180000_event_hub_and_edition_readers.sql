-- Two readers: the series hub, and one frozen edition of it.
--
-- get_event_dossier answers "what is happening at D23 right now" off the live
-- watched_events row. That row is overwritten every 30 minutes, so it cannot
-- answer "what happened at D23 in 2026" -- and that is the question with an
-- audience, because it is the one people type into a search box in October.
--
-- So the surface splits the way the data does:
--
--   get_event_hub(slug)               the series. Permanent, accrues editions,
--                                     says whether it is live right now.
--   get_event_edition(slug, edition)  one year of it. Frozen signals joined to
--                                     freshly computed content.
--
-- The edition reader is the interesting one. It reads perishable things from the
-- frozen snapshot (the curve, the peak, the movers) and recomputes everything
-- durable from the frozen WINDOW, so an edition page written today keeps
-- improving as enrichment fills in -- rosters get better, posters arrive, cast
-- links land. A page that copied the catalogue at freeze time would instead be
-- permanently as bad as the catalogue was on the day.
--
-- New in this pass: `announcements`. Until the official-channel pipeline existed
-- there was no way to say what an event actually ANNOUNCED -- attention data says
-- something happened, not what. channel_videos holds the studios' own uploads
-- with exact publish times, so the window now yields the real list: the Doomsday
-- Special Look, the Ahsoka season-2 teaser, VisionQuest, Percy Jackson season 3.
-- That is the half of an event page a reader actually came for, and it is the
-- half attention data structurally cannot provide.

create or replace function public.get_event_hub(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with ev as (
    select w.* from public.watched_events w
    where w.slug = p_slug and w.enabled and w.approval <> 'rejected'
  ),
  live_now as (select slug from public.get_live_events() where slug = p_slug),
  eds as (
    select jsonb_agg(jsonb_build_object(
             'edition_slug', e.edition_slug,
             'headline',     e.headline,
             'live_from',    e.live_from,
             'live_to',      e.live_to,
             'spike_ratio',  e.spike_ratio,
             'peak',         e.peak,
             'movers',       jsonb_array_length(e.surges),
             -- Cheap enough to count here, and it is what tells a reader which
             -- year is worth opening.
             'announcements', (
               select count(*) from public.channel_videos cv
               where cv.published_at::date between e.live_from - 1 and e.live_to + 3
                 and cv.title_id is not null
             )
           ) order by e.live_from desc) as j
    from public.event_editions e where e.slug = p_slug
  )
  select case when (select count(*) from ev) = 0 then null else
    jsonb_build_object(
      'slug',        (select slug from ev),
      'headline',    (select headline from ev),
      'accent',      (select accent from ev),
      'blurb',       (select blurb from ev),
      'enwiki_title',(select enwiki_title from ev),
      'is_live',     (select count(*) > 0 from live_now),
      -- Only meaningful while live; an edition carries its own window.
      'live_from',   (select live_from from ev),
      'live_to',     (select live_to from ev),
      'shape',       (select shape from ev),
      'spike_ratio', (select spike_ratio from ev),
      'editions',    coalesce((select j from eds), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.get_event_edition(p_slug text, p_edition text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with e as (
    select * from public.event_editions
    where slug = p_slug and edition_slug = p_edition
  ),
  -- One day either side of the frozen window: a studio drops the trailer the
  -- evening before a panel, and the pageview-derived window trails reality.
  win as (select (live_from - 1) as f, (live_to + 3) as t from e),
  announcements as (
    select jsonb_agg(x order by x->>'published_at' desc) as j
    from (
      select jsonb_build_object(
        'video_id',     cv.id,
        'title',        cv.title,
        'published_at', cv.published_at,
        'thumbnail_url', cv.thumbnail_url,
        'channel',      ch.name,
        'official',     ch.official,
        'title_id',     cv.title_id,
        'title_name',   t.title,
        'poster_url',   t.poster_url
      ) as x
      from win, public.channel_videos cv
      join public.media_channels ch on ch.id = cv.channel_id
      left join public.titles t on t.id = cv.title_id
      where cv.published_at::date between win.f and win.t
        and cv.title_id is not null
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
          where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null)
        )
      ) as x
      from win, public.title_videos v
      join public.titles t on t.id = v.title_id
      where v.published_at is not null and v.type in ('Trailer','Teaser')
        and coalesce(v.official, true)
        and v.published_at::date between win.f and win.t
      order by t.id, v.published_at desc
    ) s
  ),
  issues as (
    select jsonb_agg(x order by x->>'store_date' desc) as j
    from (
      select jsonb_build_object(
        'id', i.id, 'volume_name', i.volume_name, 'issue_number', i.issue_number,
        'cover_url', i.cover_url, 'publisher', i.publisher, 'store_date', i.store_date
      ) as x
      from win, public.comic_issues i
      where i.store_date between win.f - 4 and win.t
        and i.cover_url is not null and coalesce(i.max_fame, 0) >= 25
      order by i.store_date desc, i.max_fame desc nulls last
      limit 18
    ) s
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
        'frozen_at', (select frozen_at from e)
      ),
      -- Frozen: these cannot be recomputed once the rolling curves move on.
      'movers',        (select surges from e),
      -- Recomputed from the window, so they improve as enrichment does.
      'announcements', coalesce((select j from announcements), '[]'::jsonb),
      'trailers',      coalesce((select j from trailers), '[]'::jsonb),
      'issues',        coalesce((select j from issues), '[]'::jsonb)
    )
  end;
$$;
