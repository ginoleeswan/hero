-- The Pulse gains a fourth kind: a character surge, dated and grouped.
--
-- Surges were excluded from get_pulse_candidates on the grounds that they have no
-- event time — "pageviews_at is when WE looked, not when it happened". True while
-- only the two 7-day sums were kept. heroes.views_daily now holds the curve
-- (20260727160000), so the breakout day is recoverable and a surge can carry an
-- honest timestamp like every other card.
--
-- Why this matters: on 2026-07-27 Doctor Doom ran 20,019 -> 197,899 pageviews
-- (9.9x) on the back of the Avengers: Doomsday footage at SDCC, and the app had
-- nowhere to say so. Meanwhile the live card's "Moving fastest" line named a
-- character at fame 24.
--
-- GROUPED BY PUBLISHER, which is the part the raw numbers argue for. Measured the
-- same day: 29 Marvel characters, 10 Mattel, 10 DC and 9 Mortal Kombat were all
-- surging at once. Ungrouped that is 58 near-identical cards; the Mattel ten are
-- one fact — the Masters of the Universe film — not ten. Grouping on `franchise`
-- would be the obvious choice and does not work: the column is null for all but
-- two of those Mattel rows, so it would split the very group it exists to name.
--
-- Within a group the LOUDEST spike sets the rank, but the face is chosen by
-- recognisability x loudness. Neither alone works, and both failure modes were
-- observed: spike alone fronts Masters of the Universe with Moss Man (11.0x,
-- fame 23) instead of He-Man (fame 94); fame alone fronts the Marvel group with
-- Mister Fantastic (fame 95, 3.1x) when the story is Doctor Doom (fame 74,
-- 10.4x). Damping the spike with ln balances them — see pulse_face_weight.

create or replace function public.pulse_face_weight(p_fame smallint, p_spike numeric)
returns numeric language sql immutable as $$
  select coalesce(p_fame, 0)::numeric * ln(greatest(coalesce(p_spike, 1), 1.01));
$$;

-- ── when did the curve break out? ───────────────────────────────────────────
-- Walks back from the newest day while views stay at or above WINDOW_ENTER x the
-- series median, and returns the first day of that contiguous run. Mirrors the
-- window inference in src/lib/events/detect.ts, deliberately: a surge and a
-- convention are the same measurement on different articles.
create or replace function public.surge_started_at(p_series jsonb)
returns date
language sql
immutable
as $$
  with pts as (
    select (e->>'date')::date as d, (e->>'views')::numeric as v
    from jsonb_array_elements(coalesce(p_series, '[]'::jsonb)) e
    where e ? 'date' and e ? 'views'
  ),
  med as (
    select percentile_cont(0.5) within group (order by v) as m from pts
  ),
  flagged as (
    select d, v,
           -- 2x the median is "elevated", the same threshold the event detector
           -- uses to decide a day is inside a window.
           (v >= 2 * (select greatest(m, 1) from med)) as hot,
           row_number() over (order by d desc) as from_newest
    from pts
  ),
  -- The contiguous hot run that reaches the newest day. If the newest day isn't
  -- hot the surge has already passed and there's nothing live to date.
  run as (
    select min(d) as started
    from flagged
    where hot
      and from_newest <= coalesce(
        (select min(from_newest) from flagged where not hot), 999
      ) - 1
  )
  select started from run;
$$;

-- ── get_pulse_candidates v3 — adds `surge` ──────────────────────────────────
drop function if exists public.get_pulse_candidates(integer);

create function public.get_pulse_candidates(p_per_kind integer default 20)
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
  -- ── surges ────────────────────────────────────────────────────────────────
  surging as (
    select h.id, h.name, h.publisher, h.fame_score,
           h.pageviews_spike, h.pageviews_week,
           coalesce(h.portrait_url, h.image_url) as art,
           public.surge_started_at(h.views_daily) as started
    from public.heroes h
    where h.views_daily is not null
      and h.pageviews_spike >= 2.5
      and h.pageviews_week >= 1500
      and h.publisher is not null
      -- The encyclopedia buckets — mythology and real people pull curriculum
      -- traffic, not fandom traffic. Same exclusion as get_trending_heroes_wiki.
      and h.publisher not in ('In the Public Domain', 'Non-Fictional')
      and (h.portrait_url is not null or h.image_url is not null)
  ),
  dated as (
    select * from surging where started is not null
  ),
  grouped as (
    select publisher,
           count(*)::integer as members,
           max(pageviews_spike) as top_spike,
           max(fame_score) as max_fame,
           min(started) as started
    from dated group by publisher
  ),
  -- Loudness already picked the group's rank; this picks who represents it.
  face as (
    select distinct on (d.publisher)
           d.publisher, d.id, d.name, d.art
    from dated d
    order by d.publisher, public.pulse_face_weight(d.fame_score, d.pageviews_spike) desc
  ),
  surges as (
    select
      'surge'::text, 'surge:' || g.publisher, f.id, f.name,
      -- The spike, rounded, as the card's own "so what".
      round(g.top_spike, 1)::text,
      f.art, null::text, g.started::timestamptz, null::text,
      null::date, null::text, g.publisher,
      g.members, g.max_fame,
      g.started, null::date
    from grouped g
    join face f on f.publisher = g.publisher
    order by g.top_spike desc
    limit p_per_kind
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
  union all select * from surges
  union all select * from issues;
$$;
grant execute on function public.get_pulse_candidates(integer)
  to anon, authenticated, service_role;
