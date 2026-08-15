-- One row per EDITION of an event, so a year of it survives the next year.
--
-- watched_events is keyed by slug and holds one row per event SERIES. Every
-- sync overwrites views_daily, baseline, peak, spike_ratio, live_from and
-- live_to, so `/event/d23` is not "D23 2026", it is "D23, currently" — next
-- August it silently becomes D23 2027 and this year is gone. SDCC 2026 already
-- shows the damage: its stored spike_ratio now reads 0.82, BELOW baseline,
-- because the July spike has rolled out of the 27-day views_daily series. The
-- 3.35x peak that detection recorded survives only because a design doc happens
-- to mention it.
--
-- What is stored here is what PERISHES, and nothing else:
--
--   perishable, snapshotted  the event's own curve, baseline/peak/spike/edits,
--                            and the surge list (heroes.views_daily is itself a
--                            rolling window, so the movers are unrecoverable)
--   durable, recomputed      trailers and issues — title_videos and comic_issues
--                            keep their history, so an edition page can derive
--                            them from the frozen window at read time, and old
--                            editions keep IMPROVING as enrichment fills in
--
-- Copying the catalogue in here would freeze the rosters at their worst.
--
-- Keying: NOT (slug, live_from). The detector refines its window as lagging
-- pageview data arrives — D23's window read 08-11→08-13 on the 15th while the
-- event actually ran the 14th to the 16th — so live_from moves, and keying on it
-- would insert a second row every time it shifted. Instead an edition is matched
-- by PROXIMITY: a freeze within EDITION_GAP_DAYS of an existing edition updates
-- it, anything further away starts a new one. That also handles Comiket, which
-- runs twice in a calendar year, without the year alone having to be unique.

create table if not exists public.event_editions (
  slug          text not null references public.watched_events(slug) on delete cascade,
  -- URL segment: '2026' normally, '2026-08' when that year already holds an
  -- edition of the same event. Pretty in the common case, unambiguous always.
  edition_slug  text not null,
  headline      text not null,
  accent        text,

  -- the frozen window, as last understood while the event was live
  live_from     date not null,
  live_to       date not null,

  -- perishable detector signals
  views_daily   jsonb not null,
  baseline      integer,
  peak          integer,
  spike_ratio   numeric,
  shape         text,
  edits_recent  integer,

  -- perishable derived content: who moved, at the moment they moved
  surges        jsonb not null default '[]'::jsonb,

  first_detected_at timestamptz,
  frozen_at     timestamptz not null default now(),

  primary key (slug, edition_slug)
);

create index if not exists event_editions_window_idx
  on public.event_editions (live_from desc);

alter table public.event_editions enable row level security;

drop policy if exists event_editions_public_read on public.event_editions;
create policy event_editions_public_read on public.event_editions
  for select to anon, authenticated using (true);

-- ── freeze ──────────────────────────────────────────────────────────────────
-- Called for any row the detector currently judges `live`, on every sync.
--
-- Continuous upsert rather than freeze-on-transition, deliberately: there is no
-- single moment to miss. If the function errors, or a verdict flickers, or a
-- deploy lands mid-event, the next 30-minute pass simply rewrites the row. When
-- the event stops being live the row stops being updated, and what remains IS
-- the frozen record. It also self-corrects the lagging window — D23 freezing at
-- 08-11→08-13 today will read 08-11→08-16 once the pageviews catch up, without
-- anything having to detect that the event ended.

create or replace function public.freeze_event_edition(p_slug text)
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  -- Two windows closer together than this are the same edition seen twice as
  -- the detector refined it; further apart is a genuinely separate edition.
  -- Comiket's two runs are ~4 months apart, and no single convention's window
  -- wanders by six weeks.
  c_edition_gap_days constant integer := 45;
  v_ev      public.watched_events%rowtype;
  v_slug    text;
  v_surges  jsonb;
begin
  select * into v_ev from public.watched_events where slug = p_slug;
  if not found or v_ev.live_from is null or v_ev.views_daily is null then
    return null;
  end if;

  -- Reuse the nearby edition's own slug if there is one, so a shifting window
  -- updates in place instead of forking.
  select e.edition_slug into v_slug
  from public.event_editions e
  where e.slug = p_slug
    and abs(e.live_from - v_ev.live_from) <= c_edition_gap_days
  order by abs(e.live_from - v_ev.live_from)
  limit 1;

  if v_slug is null then
    v_slug := to_char(v_ev.live_from, 'YYYY');
    -- Same year, different edition (Comiket) — fall back to year-month.
    if exists (select 1 from public.event_editions e
               where e.slug = p_slug and e.edition_slug = v_slug) then
      v_slug := to_char(v_ev.live_from, 'YYYY-MM');
    end if;
  end if;

  -- The movers, by the same recognisability x loudness weight the rail and the
  -- dossier use, so the archive ranks them the way the app always has.
  select coalesce(jsonb_agg(x order by (x->>'weight')::numeric desc), '[]'::jsonb)
  into v_surges
  from (
    select jsonb_build_object(
      'hero_id', h.id, 'name', h.name, 'publisher', h.publisher,
      'portrait_url', coalesce(h.portrait_url, h.image_url),
      'spike', round(h.pageviews_spike, 1), 'pageviews_week', h.pageviews_week,
      'fame_score', h.fame_score,
      'weight', round(public.pulse_face_weight(h.fame_score, h.pageviews_spike), 1)
    ) as x
    from public.heroes h
    cross join lateral (select public.surge_started_at(h.views_daily) as started) st
    where h.views_daily is not null
      and h.pageviews_spike >= 2.5
      and h.pageviews_week >= 1500
      and h.publisher is not null
      and h.publisher not in ('In the Public Domain', 'Non-Fictional')
      and (h.portrait_url is not null or h.image_url is not null)
      and st.started between v_ev.live_from - 1
                         and coalesce(v_ev.live_to, v_ev.live_from) + 3
    limit 50
  ) s;

  insert into public.event_editions as e (
    slug, edition_slug, headline, accent, live_from, live_to,
    views_daily, baseline, peak, spike_ratio, shape, edits_recent,
    surges, first_detected_at, frozen_at
  ) values (
    p_slug, v_slug, v_ev.headline, v_ev.accent,
    v_ev.live_from, coalesce(v_ev.live_to, v_ev.live_from),
    v_ev.views_daily, v_ev.baseline, v_ev.peak, v_ev.spike_ratio,
    v_ev.shape, v_ev.edits_recent,
    v_surges, v_ev.first_detected_at, now()
  )
  on conflict (slug, edition_slug) do update set
    headline     = excluded.headline,
    accent       = excluded.accent,
    live_from    = excluded.live_from,
    live_to      = excluded.live_to,
    views_daily  = excluded.views_daily,
    baseline     = excluded.baseline,
    -- Keep the loudest reading ever seen. The curve rolls off, so a later
    -- freeze can observe a SMALLER peak for the same event; taking the max means
    -- a late re-freeze can never quietly shrink history.
    peak         = greatest(coalesce(e.peak, 0), coalesce(excluded.peak, 0)),
    spike_ratio  = greatest(coalesce(e.spike_ratio, 0), coalesce(excluded.spike_ratio, 0)),
    shape        = excluded.shape,
    edits_recent = greatest(coalesce(e.edits_recent, 0), coalesce(excluded.edits_recent, 0)),
    -- Same reasoning: never trade a populated surge list for an emptied one.
    surges       = case when jsonb_array_length(excluded.surges) >= jsonb_array_length(e.surges)
                        then excluded.surges else e.surges end,
    first_detected_at = coalesce(e.first_detected_at, excluded.first_detected_at),
    frozen_at    = now();

  return v_slug;
end;
$$;

revoke all on function public.freeze_event_edition(text) from public, anon, authenticated;

-- Freeze every event currently judged live. This is what the sync calls, and
-- what a backfill can call by hand.
create or replace function public.freeze_live_editions()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_slugs text[] := '{}';
  r record;
  v text;
begin
  for r in
    select slug from public.watched_events
    where enabled and approval <> 'rejected' and verdict = 'live' and live_from is not null
  loop
    v := public.freeze_event_edition(r.slug);
    if v is not null then v_slugs := v_slugs || (r.slug || ':' || v); end if;
  end loop;
  return jsonb_build_object('frozen', v_slugs);
end;
$$;

revoke all on function public.freeze_live_editions() from public, anon, authenticated;
