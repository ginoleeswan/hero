-- Two columns the archive has needed since it went past one year.
--
-- SUPPRESSED_REASON — the detector mints one edition per calendar year from the
-- biggest qualifying run, which silently assumes the article only ever spikes
-- because the event happened. It does not:
--
--   Star Wars Celebration 2024 (1-6 May) and 2026 (4-7 May) are May the Fourth.
--     There was no Celebration in either year — 2023 London, then 2025 Japan.
--   DC FanDome 2022 (23 Jul - 7 Aug) is a cancellation. Warner confirmed there
--     would be no FanDome that year; the 16-day window, more than double any
--     real edition's, is the news cycle plus SDCC 2022 next door.
--
-- Checked against the calendar rather than assumed: every other edition of these
-- eight events corroborates. The Game Awards lands exactly one day after the
-- real show in all ten years, which is the readership answering that evening.
--
-- Suppressed, not deleted. The movers on these rows cost a per-hero Wikimedia
-- sweep to build, the curve is real data about a real spike, and a future rule
-- may want to reclassify rather than discard them. Reads filter on the column.
--
-- RECAP — one sentence of what actually happened, which is the only thing on an
-- event page no API can serve. 129 of 142 editions have no announcements at all
-- and never will: YouTube's RSS feed returns 15 items, so nothing before August
-- 2026 is recoverable. Those pages can show a curve, some movers and some
-- trailers, and still not answer "what happened at D23 2019".
--
-- It is editorial, and the schema says so by keeping it in its own column rather
-- than folding it into the measured fields. It is written only where the
-- remembered event and the independently-detected window agree — the corroboration
-- above is the gate, not a formality.

alter table public.event_editions
  add column if not exists suppressed_reason text,
  add column if not exists recap text;

comment on column public.event_editions.suppressed_reason is
  'Non-null means the detector caught a spike that was not this event. Excluded from all reads. See the migration for the three known classes.';
comment on column public.event_editions.recap is
  'Editorial: one sentence on what actually happened. Written only where the known event date corroborates live_from/live_to. Never generated from the measurements.';

update public.event_editions set suppressed_reason =
  'May the Fourth. There was no Star Wars Celebration this year — 2023 was London, 2025 was Japan.'
where slug = 'swce' and edition_slug in ('2024', '2026');

update public.event_editions set suppressed_reason =
  'DC FanDome was cancelled in 2022. This window is the news cycle around that, overlapping San Diego Comic-Con.'
where slug = 'dc-fandome' and edition_slug = '2022';
