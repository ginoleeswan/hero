-- An edition happened somewhere, and the page never said where.
--
-- The D23 pages carry the argument in prose — "D23 Expo Japan, held at the Tokyo
-- Disney Resort rather than Anaheim", "Destination D23, again at Walt Disney
-- World" — which is the archive telling a reader in a sentence what a pin says
-- at a glance. Three of the twenty-one watched events genuinely move (d23, swce
-- and pax); the rest have sat in the same hall for a decade. Both are worth
-- stating, and only the edition can state either, which is why this is on
-- event_editions rather than on watched_events.
--
-- Nullable on purpose, and NULL is a real answer rather than missing data: a
-- Nintendo Direct and DC FanDome have no venue because they are broadcasts, and
-- the gamescom rows for 2020 and 2021 were all-digital. The page renders no map
-- for those, which is the honest thing — a pin on Cologne for a show nobody
-- travelled to would be a small lie.
--
-- Coordinates are the venue's, not the city's, so "Tokyo Big Sight" and "Makuhari
-- Messe" are two different places rather than both being "Tokyo". They are used
-- for an orthographic globe at ~120pt, so a hundred metres is far below the
-- rendering's resolution; they are recorded precisely anyway because a coordinate
-- rounded for today's design is a coordinate that cannot serve tomorrow's.

alter table public.event_editions
  add column if not exists venue text,
  add column if not exists venue_city text,
  add column if not exists venue_lat numeric(8, 4),
  add column if not exists venue_lon numeric(8, 4);

comment on column public.event_editions.venue is
  'Where this edition was held. NULL means it had no venue — a broadcast or an all-digital year — not that we failed to record one.';
comment on column public.event_editions.venue_city is
  'City and country as a reader would say it: "San Diego, USA", "Chiba, Japan".';

-- ── the events that have not moved ──────────────────────────────────────────
-- One statement per series. Written as a join against a values list rather than
-- twenty updates so the whole set is readable as a table, which is what it is.
update public.event_editions e
set venue = v.venue, venue_city = v.city, venue_lat = v.lat, venue_lon = v.lon
from (values
  ('sdcc',            'San Diego Convention Center',      'San Diego, USA',      32.7065,  -117.1614),
  ('eccc',            'Seattle Convention Center',        'Seattle, USA',        47.6116,  -122.3320),
  ('nycc',            'Javits Center',                    'New York, USA',       40.7577,   -74.0026),
  ('wondercon',       'Anaheim Convention Center',        'Anaheim, USA',        33.8003,  -117.9192),
  ('anime-expo',      'Los Angeles Convention Center',    'Los Angeles, USA',    34.0400,  -118.2695),
  ('dragon-con',      'Downtown Atlanta hotels',          'Atlanta, USA',        33.7600,   -84.3880),
  ('fan-expo-canada', 'Metro Toronto Convention Centre',  'Toronto, Canada',     43.6426,   -79.3871),
  ('comiket',         'Tokyo Big Sight',                  'Tokyo, Japan',        35.6300,   139.7966),
  ('gamescom',        'Koelnmesse',                       'Cologne, Germany',    50.9470,     6.9830),
  ('mcm-london',      'ExCeL London',                     'London, UK',          51.5080,     0.0290),
  ('lucca',           'Lucca city centre',                'Lucca, Italy',        43.8430,    10.5020),
  ('angouleme',       'Angoulême city centre',            'Angoulême, France',   45.6500,     0.1600),
  ('ccxp',            'São Paulo Expo',                   'São Paulo, Brazil',  -23.6280,   -46.6580),
  ('game-awards',     'Peacock Theater',                  'Los Angeles, USA',    34.0446,  -118.2673),
  ('summer-game-fest','YouTube Theater',                  'Inglewood, USA',      33.9450,  -118.3390)
) as v(slug, venue, city, lat, lon)
where e.slug = v.slug;

-- ── the three that move ─────────────────────────────────────────────────────
-- D23. The Expo is Anaheim in even years; Destination D23 is a smaller show at
-- Walt Disney World; and 2018 is D23 Expo Japan, which is a different event in a
-- different hemisphere sharing a name. That last one is the whole reason a map
-- belongs on the EDITION and not on the hub.
update public.event_editions e
set venue = v.venue, venue_city = v.city, venue_lat = v.lat, venue_lon = v.lon
from (values
  ('2017', 'Anaheim Convention Center', 'Anaheim, USA',    33.8003, -117.9192),
  ('2018', 'Tokyo Disney Resort',       'Urayasu, Japan',  35.6329,  139.8804),
  ('2019', 'Anaheim Convention Center', 'Anaheim, USA',    33.8003, -117.9192),
  ('2022', 'Anaheim Convention Center', 'Anaheim, USA',    33.8003, -117.9192),
  ('2023', 'Walt Disney World',         'Bay Lake, USA',   28.3852,  -81.5639),
  ('2024', 'Anaheim Convention Center', 'Anaheim, USA',    33.8003, -117.9192),
  ('2025', 'Walt Disney World',         'Bay Lake, USA',   28.3852,  -81.5639),
  ('2026', 'Anaheim Convention Center', 'Anaheim, USA',    33.8003, -117.9192)
) as v(edition_slug, venue, city, lat, lon)
where e.slug = 'd23' and e.edition_slug = v.edition_slug;

-- Star Wars Celebration moves country to country by design.
update public.event_editions e
set venue = v.venue, venue_city = v.city, venue_lat = v.lat, venue_lon = v.lon
from (values
  ('2019', 'McCormick Place',           'Chicago, USA',   41.8514,  -87.6167),
  ('2022', 'Anaheim Convention Center', 'Anaheim, USA',   33.8003, -117.9192),
  ('2023', 'ExCeL London',              'London, UK',     51.5080,    0.0290),
  ('2025', 'Makuhari Messe',            'Chiba, Japan',   35.6480,  140.0340)
) as v(edition_slug, venue, city, lat, lon)
where e.slug = 'swce' and e.edition_slug = v.edition_slug;

-- PAX is several shows under one name. Attributed by the window's season, which
-- is what actually separates them: East runs late winter or spring in Boston,
-- West runs around Labor Day in Seattle.
update public.event_editions e
set venue = v.venue, venue_city = v.city, venue_lat = v.lat, venue_lon = v.lon
from (values
  ('2016', 'Seattle Convention Center',              'Seattle, USA', 47.6116, -122.3320),
  ('2017', 'Boston Convention and Exhibition Center','Boston, USA',  42.3450,  -71.0450),
  ('2018', 'Boston Convention and Exhibition Center','Boston, USA',  42.3450,  -71.0450),
  ('2019', 'Boston Convention and Exhibition Center','Boston, USA',  42.3450,  -71.0450),
  ('2020', 'Boston Convention and Exhibition Center','Boston, USA',  42.3450,  -71.0450),
  ('2022', 'Seattle Convention Center',              'Seattle, USA', 47.6116, -122.3320),
  ('2023', 'Boston Convention and Exhibition Center','Boston, USA',  42.3450,  -71.0450),
  ('2024', 'Seattle Convention Center',              'Seattle, USA', 47.6116, -122.3320),
  ('2025', 'Boston Convention and Exhibition Center','Boston, USA',  42.3450,  -71.0450),
  ('2026', 'Boston Convention and Exhibition Center','Boston, USA',  42.3450,  -71.0450)
) as v(edition_slug, venue, city, lat, lon)
where e.slug = 'pax' and e.edition_slug = v.edition_slug;

-- ── the years nobody travelled to ───────────────────────────────────────────
-- gamescom 2020 and 2021 ran with no show floor. The hall is still Koelnmesse on
-- paper and that is exactly the problem: a pin on Cologne would say a crowd was
-- there. The recap already says "All-digital. No show floor, no queues."
update public.event_editions
set venue = null, venue_city = null, venue_lat = null, venue_lon = null
where slug = 'gamescom' and edition_slug in ('2020', '2021');
