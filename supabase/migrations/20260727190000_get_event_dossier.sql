-- get_event_dossier — a permanent page for a watched event.
--
-- Design: docs/superpowers/specs/2026-07-27-pulse-reach-design.md §3
--
-- The Pulse rail is empty by Monday. This is the same week's facts as a page
-- that is still worth reading a year later, and it accretes: every approved
-- event eventually has one.
--
-- Assembled entirely from data already stored, in one round trip (jsonb, the
-- same shape as get_house and get_explore_bundle):
--
--   the window, and the attention curve that justified it   watched_events
--   the trailers that dropped inside it                     title_videos
--   the characters that surged, and what moved them         heroes + attribute_surge
--   the comics that shipped that week                       comic_issues
--
-- Approved events only. The approval gate exists precisely so a false positive
-- cannot mint a public artefact, and a page is a much more durable artefact than
-- a rail card.
--
-- The window is widened by the same grace get_live_events uses (3 days when
-- ongoing, else 1), because the pageview signal lags reality and a trailer that
-- dropped on the convention's real last day would otherwise fall outside it.

create or replace function public.get_event_dossier(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select w.*,
           w.live_from as win_from,
           (coalesce(w.live_to, w.live_from) + (case when w.ongoing then 3 else 1 end)) as win_to
    from public.watched_events w
    where w.slug = p_slug
      and w.enabled
      and w.approval = 'approved'
      and w.live_from is not null
  ),
  trailers as (
    -- Ordered by how well the catalogue can illustrate it, not by clock. A page
    -- led by a title with no characters we hold is a page about someone else's
    -- news; recency alone put a Kamen Rider film above Avengers: Doomsday.
    select jsonb_agg(x order by (x->>'cast_count')::int desc, x->>'published_at' desc) as j
    from (
      select distinct on (t.id) jsonb_build_object(
        'title_id', t.id,
        'title', t.title,
        'poster_url', t.poster_url,
        'backdrop_url', t.backdrop_url,
        'release_date', t.release_date,
        'video_key', v.key,
        'video_type', v.type,
        'published_at', v.published_at,
        'cast_count', (
          select count(*) from public.hero_media_appearances a
          join public.heroes h on h.id = a.hero_id
          where a.title_id = t.id
            and (h.portrait_url is not null or h.image_url is not null)
        )
      ) as x
      from ev, public.title_videos v
      join public.titles t on t.id = v.title_id
      where v.published_at is not null
        and v.type in ('Trailer', 'Teaser')
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
        'hero_id', h.id,
        'name', h.name,
        'publisher', h.publisher,
        'portrait_url', coalesce(h.portrait_url, h.image_url),
        'spike', round(h.pageviews_spike, 1),
        'pageviews_week', h.pageviews_week,
        'started', st.started,
        'cause_kind', att.cause_kind,
        'cause_label', att.cause_label,
        'weight', round(public.pulse_face_weight(h.fame_score, h.pageviews_spike), 1)
      ) as x
      from ev, public.heroes h
      cross join lateral (select public.surge_started_at(h.views_daily) as started) st
      left join lateral public.attribute_surge(h.id, st.started) att on true
      where h.views_daily is not null
        and h.pageviews_spike >= 2.5
        and h.pageviews_week >= 1500
        and h.publisher is not null
        and h.publisher not in ('In the Public Domain', 'Non-Fictional')
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
        'id', i.id,
        'volume_name', i.volume_name,
        'issue_number', i.issue_number,
        'cover_url', i.cover_url,
        'publisher', i.publisher,
        'store_date', i.store_date
      ) as x
      from ev, public.comic_issues i
      where i.store_date between ev.win_from - 4 and ev.win_to
        and i.cover_url is not null
        and coalesce(i.max_fame, 0) >= 25
      order by i.store_date desc, i.max_fame desc nulls last
      limit 18
    ) s
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'slug', ev.slug,
      'headline', ev.headline,
      'blurb', ev.blurb,
      'accent', ev.accent,
      'live_from', ev.live_from,
      'live_to', ev.live_to,
      'ongoing', ev.ongoing,
      'shape', ev.shape,
      -- The detection evidence. Publishing it is the point: nobody else shows
      -- how they know a convention is on.
      'spike_ratio', ev.spike_ratio,
      'baseline', ev.baseline,
      'peak', ev.peak,
      'edits_recent', ev.edits_recent,
      'views_daily', ev.views_daily,
      'first_detected_at', ev.first_detected_at
    ),
    'trailers', coalesce((select j from trailers), '[]'::jsonb),
    'surges', coalesce((select j from surges), '[]'::jsonb),
    'issues', coalesce((select j from issues), '[]'::jsonb)
  )
  from ev;
$$;
grant execute on function public.get_event_dossier(text)
  to anon, authenticated, service_role;
