-- The dossier finally says what was ANNOUNCED, not just that something happened.
--
-- Until now an event page could only report attention: a spike, a curve, which
-- characters people went and read about. That is the half of the story nobody
-- else publishes, and it is also not the half a reader arrives for. Someone
-- opening a D23 page wants the X-Men cast reveal, the Doomsday Special Look and
-- the Ahsoka season-2 teaser -- and Wikipedia readership can never supply those,
-- because attention data records that something moved, never what it was.
--
-- channel_videos closes that gap. The studios' own uploads carry exact publish
-- times, so "what was announced during the window" is now a straight query
-- rather than something the app structurally could not know. For D23 2026 it
-- returns the X-Men MCU reveal, Star Wars: Starfighter, VisionQuest, Ahsoka
-- season 2, Percy Jackson season 3 and the Doomsday Special Look.
--
-- Only matched videos are returned (`title_id is not null`). An unmatched upload
-- is real news but the page cannot say what it is ABOUT, and a list of bare
-- marketing strings with nothing to link to is worse than a shorter honest list.
-- Official channels sort first: when both a studio and a press channel cover the
-- same beat, the studio is the one that actually announced it.

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
  announcements as (
    select jsonb_agg(x order by (x->>'official')::boolean desc, x->>'published_at' desc) as j
    from (
      select jsonb_build_object(
        'video_id', cv.id,
        'title', cv.title,
        'published_at', cv.published_at,
        'thumbnail_url', cv.thumbnail_url,
        'channel', ch.name,
        'official', ch.official,
        'title_id', cv.title_id,
        'title_name', t.title,
        'poster_url', t.poster_url
      ) as x
      from ev, public.channel_videos cv
      join public.media_channels ch on ch.id = cv.channel_id
      join public.titles t on t.id = cv.title_id
      where cv.published_at::date between ev.win_from - 1 and ev.win_to
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
    'announcements', coalesce((select j from announcements), '[]'::jsonb),
    'trailers', coalesce((select j from trailers), '[]'::jsonb),
    'surges', coalesce((select j from surges), '[]'::jsonb),
    'issues', coalesce((select j from issues), '[]'::jsonb)
  )
  from ev;
$function$;
