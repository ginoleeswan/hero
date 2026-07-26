-- Watched real-world events — automatic detection of "is SDCC on right now?"
--
-- Why detection instead of a calendar: there is no usable public API for fan
-- convention dates. Querying every dated comic convention on Wikidata returns
-- 16 rows, the newest from 2022 — future editions simply aren't modelled. So we
-- don't read a schedule; we watch each event's own Wikipedia article and infer
-- the window from attention. Two free, independent, key-less signals:
--
--   * daily pageviews — high signal, but the Wikimedia API lags 1-2 days
--   * article edit rate — no lag, so it's what catches an event on day one
--
-- Both are required for a `live` verdict. Measured on 2026-07-26 with SDCC 2026
-- actually running: the SDCC article ran 3.35x baseline pageviews with 13 edits
-- in four days (a ~65x edit-rate burst), while NYCC — dormant — drifted to 1.74x
-- on pageviews with a single edit. Pageviews alone would have flagged both.
-- Scoring lives in src/lib/events/detect.ts, mirrored by the
-- sync-watched-events edge function; this table is its state + a human gate.
--
-- Deliberately NOT auto-activating anything: a false positive here would re-skin
-- the whole Explore page, so detection sets verdict/window and an admin flips
-- `approval`. get_live_events only ever returns approved rows.

create table if not exists public.watched_events (
  slug text primary key,
  -- Human-facing name for the band ("San Diego Comic-Con").
  headline text not null,
  -- en.wikipedia article title, underscored, canonical (not a redirect).
  enwiki_title text not null,
  -- Optional hex accent; the takeover skin is built from it. Null → brand orange.
  accent text,
  blurb text,
  enabled boolean not null default true,

  -- ── detector state (written by sync-watched-events via the service role) ──
  -- The full daily series, not just the ratio: curve SHAPE distinguishes a
  -- discrete announcement (sharp spike, fast decay) from a running event
  -- (sustained plateau), and they want different copy and different decay.
  views_daily jsonb,
  baseline integer,
  peak integer,
  spike_ratio numeric,
  shape text check (shape is null or shape in ('sustained', 'decaying', 'easing', 'flat')),
  edits_recent integer,
  edit_burst_ratio numeric,
  verdict text not null default 'idle' check (verdict in ('idle', 'watch', 'live')),
  -- Inferred window: the contiguous run of elevated days.
  live_from date,
  live_to date,
  -- True while the elevated run reaches the newest day we have data for, i.e.
  -- the event probably hasn't ended (pageviews are 1-2 days behind reality).
  ongoing boolean not null default false,
  checked_at timestamptz,
  first_detected_at timestamptz,

  -- ── human gate ──
  approval text not null default 'pending' check (approval in ('pending', 'approved', 'rejected')),
  approval_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists watched_events_live_idx
  on public.watched_events (verdict, approval, live_from desc)
  where enabled;

-- RLS on with deliberately no policies: the client reads through the
-- security-definer reader below, never straight from the table. The edge
-- function writes with the service role, which bypasses RLS.
alter table public.watched_events enable row level security;

-- ── seed: the watch list ────────────────────────────────────────────────────
-- Every enwiki_title below was resolved through the MediaWiki API (redirects
-- followed) — "D23 Expo", "Comic Con Experience" and "MCM London Comic Con" are
-- redirects, so their canonical targets are stored instead. A wrong title here
-- fails silently as a permanently idle row, so keep them canonical.
insert into public.watched_events (slug, headline, enwiki_title, accent) values
  ('sdcc',             'San Diego Comic-Con',   'San_Diego_Comic-Con',                     '#CE9B33'),
  ('nycc',             'New York Comic Con',    'New_York_Comic_Con',                      '#B5302B'),
  ('d23',              'D23',                   'D23_(Disney)',                            '#15A1AB'),
  ('swce',             'Star Wars Celebration', 'Star_Wars_Celebration',                   '#F9B222'),
  ('anime-expo',       'Anime Expo',            'Anime_Expo',                              '#7c3aed'),
  ('comiket',          'Comiket',               'Comiket',                                 '#7c3aed'),
  ('gamescom',         'Gamescom',              'Gamescom',                                '#15A1AB'),
  ('dc-fandome',       'DC FanDome',            'DC_FanDome',                              '#15A1AB'),
  ('mcm-london',       'MCM Comic Con London',  'MCM_Comic_Con_London',                    '#CE9B33'),
  ('eccc',             'Emerald City Comic Con','Emerald_City_Comic_Con',                  '#63A936'),
  ('wondercon',        'WonderCon',             'WonderCon',                               '#E77333'),
  ('dragon-con',       'Dragon Con',            'Dragon_Con',                              '#63A936'),
  ('fan-expo-canada',  'Fan Expo Canada',       'Fan_Expo_Canada',                         '#E77333'),
  ('ccxp',             'CCXP',                  'CCXP',                                    '#63A936'),
  ('lucca',            'Lucca Comics & Games',  'Lucca_Comics_&_Games',                    '#CE9B33'),
  ('angouleme',        'Angoulême Comics Festival', 'Angoulême_International_Comics_Festival', '#CE9B33'),
  ('nintendo-direct',  'Nintendo Direct',       'Nintendo_Direct',                         '#B5302B'),
  ('game-awards',      'The Game Awards',       'The_Game_Awards',                         '#15A1AB'),
  ('summer-game-fest', 'Summer Game Fest',      'Summer_Game_Fest',                        '#15A1AB'),
  ('pax',              'PAX',                   'PAX_(event)',                             '#15A1AB')
on conflict (slug) do nothing;

-- ── public reader ───────────────────────────────────────────────────────────
-- Approved + live + inside the window. The grace on live_to absorbs the
-- pageview lag: an event still trending on the newest day we have gets 3 extra
-- days before it falls out, a finished one gets 1. If the detector stops
-- confirming, the row ages out on its own with no manual teardown.
create or replace function public.get_live_events()
returns table (
  slug text, headline text, blurb text, accent text,
  shape text, spike_ratio numeric, live_from date, live_to date, ongoing boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select w.slug, w.headline, w.blurb, w.accent,
         w.shape, w.spike_ratio, w.live_from, w.live_to, w.ongoing
  from public.watched_events w
  where w.enabled
    and w.approval = 'approved'
    and w.verdict = 'live'
    and w.live_from is not null
    and current_date >= w.live_from
    and current_date <= coalesce(w.live_to, current_date)
                        + (case when w.ongoing then 3 else 1 end)
  order by w.spike_ratio desc nulls last
  limit 4;
$$;
grant execute on function public.get_live_events() to anon, authenticated, service_role;

-- ── admin surface ───────────────────────────────────────────────────────────
-- Full detector state, including idle rows, so the command centre can show what
-- is being watched and what it currently reads.
create or replace function public.admin_list_watched_events()
returns setof public.watched_events
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  return query
    select * from public.watched_events
    order by (verdict = 'live') desc, spike_ratio desc nulls last, headline;
end $$;
grant execute on function public.admin_list_watched_events() to authenticated, service_role;

-- Flip the gate. Approving a row is what allows the takeover to render; the
-- detector never sets this itself.
create or replace function public.admin_set_watched_event_approval(
  p_slug text,
  p_approval text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_approval not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid approval: %', p_approval;
  end if;
  with upd as (
    update public.watched_events
    set approval = p_approval, approval_at = now()
    where slug = p_slug
    returning 1
  )
  select count(*) into v_updated from upd;
  return v_updated;
end $$;
grant execute on function public.admin_set_watched_event_approval(text, text)
  to authenticated, service_role;

-- Toggle whether an event is polled at all (a dead article, a retired con).
create or replace function public.admin_set_watched_event_enabled(
  p_slug text,
  p_enabled boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  with upd as (
    update public.watched_events set enabled = p_enabled where slug = p_slug returning 1
  )
  select count(*) into v_updated from upd;
  return v_updated;
end $$;
grant execute on function public.admin_set_watched_event_enabled(text, boolean)
  to authenticated, service_role;

-- ── schedule ────────────────────────────────────────────────────────────────
-- Twice an hour at :07/:37, off the top of the hour where sync-new-comics fires
-- and well clear of the 03:40-04:40 nightly crunch. 20 articles x 2 cheap
-- Wikimedia calls is a trivial job; the cadence exists so a convention is
-- noticed the same day it opens, not so the numbers move faster (pageviews are
-- daily anyway — the edit signal is the one that rewards frequency).
-- To PAUSE: select cron.unschedule('sync-watched-events');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-watched-events',
  '7,37 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-watched-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
