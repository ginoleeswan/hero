-- An edition's label must match its dates.
--
-- The hub was rendering "2019 · 6–9 JANUARY 2020" and "2018 · 12–18 MARCH 2019".
-- findEditions names an edition after the year the RUN STARTS, and a run that
-- begins in the quiet days before an event can start on the other side of New
-- Year — or, for the ECCC row, simply open early enough to land in the year
-- before. The label should come from the peak, which is the event. The detector
-- is fixed in the same change (backfill-event-editions/index.ts, peakIndex).
--
-- ECCC. The March 2019 window is Emerald City Comic Con 2019 (14-17 March), so it
-- is renamed to 2019. That name is currently taken by two rows that are not
-- conventions, so both move aside and are suppressed:
--   October 2019 — no ECCC has ever been held in October.
--   March 2020 — ECCC 2020 was called off days before it was due to open. Same
--     class as the DC FanDome 2022 row: a cancellation makes an article spike
--     exactly like the event would have.
-- Suppression does not free the primary key, so the rename has to come after the
-- MOVE, not merely after the flag — the first attempt at this migration failed
-- on event_editions_pkey for exactly that reason.
--
-- Nintendo Direct. Two shows genuinely ran in 2020, in January and July, so the
-- year alone cannot name either. The schema already anticipated this — an
-- edition_slug is documented as '2026-08' when a year holds two — it had just
-- never been used.

update public.event_editions
set edition_slug = '2019-10',
    suppressed_reason = 'No Emerald City Comic Con has been held in October. The convention runs in late winter.'
where slug = 'eccc' and edition_slug = '2019';

update public.event_editions
set suppressed_reason = 'Emerald City Comic Con 2020 was called off days before it opened. This window is the cancellation, not the show.'
where slug = 'eccc' and edition_slug = '2020';

update public.event_editions set edition_slug = '2019'
where slug = 'eccc' and edition_slug = '2018';

update public.event_editions set edition_slug = '2020-07'
where slug = 'nintendo-direct' and edition_slug = '2020';
update public.event_editions set edition_slug = '2020-01'
where slug = 'nintendo-direct' and edition_slug = '2019';

update public.event_editions set recap =
  'A Pokémon-led Direct to open the year — the first of two Nintendo ran in 2020.'
where slug = 'nintendo-direct' and edition_slug = '2020-01';
