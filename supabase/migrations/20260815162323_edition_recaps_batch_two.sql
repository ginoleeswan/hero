-- Second recap pass, and one real identification.
--
-- D23 2023 and 2025 looked wrong: the Expo is biennial (2017, 2019, 2022, 2024,
-- 2026) so neither year should exist. They are not artifacts. Destination D23 is
-- the smaller show Disney runs at Walt Disney World between Expos, and it ran
-- 8-10 September 2023 and 29-31 August 2025 — which is the detected window in
-- both cases, to the day. The rows are right; what was missing was that the page
-- had no way to say it was a different, smaller event than the one above it.
--
-- The rest are structural facts about the show rather than announcements, which
-- is the only kind of claim worth making about the years where recollection of a
-- specific reveal would be a guess. Gamescom 2020 and 2021 being digital is a
-- fact about what the event WAS; "which trailer opened Opening Night Live in
-- 2024" is not something to assert from memory.
--
-- Everything else stays null. The gaming showcases in particular are honestly
-- thin: the mover pool for a Nintendo Direct is 10 Nintendo characters and 5
-- Capcom ones, because that is how many the catalogue holds with a Wikipedia
-- article. Padding those pages with a remembered slate is the one thing that
-- would make them worse.

update public.event_editions set recap = v.recap
from (values
  ('d23','2023','Destination D23 at Walt Disney World — the smaller show Disney runs between Expos, not the Anaheim event.'),
  ('d23','2025','Destination D23, again at Walt Disney World. The Anaheim Expo runs in even years.'),

  ('gamescom','2019','The first Opening Night Live, which turned the show’s opening into a broadcast.'),
  ('gamescom','2020','All-digital. No show floor, no queues — the pandemic year.'),
  ('gamescom','2021','Digital for a second year running.'),

  ('nintendo-direct','2020','A Direct Mini: Partner Showcase, the pandemic year’s stand-in for the full show.')
) as v(slug, edition_slug, recap)
where event_editions.slug = v.slug and event_editions.edition_slug = v.edition_slug;
