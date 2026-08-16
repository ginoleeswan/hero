-- Recaps for the editions that had none.
--
-- 99 of 137 editions were a curve, a multiple and a list of names. The curve is
-- the thing nobody else publishes and it is still not what a reader came for:
-- "8.2x" answers how much, never what.
--
-- Written under three rules, because the alternative to a rule here is invention
-- that reads exactly like fact:
--
--  1. NOTHING THAT IS NOT CHECKABLE. No attendance figures, no "fans queued for
--     hours", no announcements attributed from memory. Where the only honest
--     thing to say about a year is what KIND of year it was, that is what it
--     says.
--  2. THE RECAP DESCRIBES THE STORED WINDOW, not the event's real dates when
--     the two disagree. Angoulême 2016 is the case that made this a rule: the
--     festival ran 28-31 January, but the window here is 6-8 January, and it is
--     not an error — the Grand Prix shortlist went out on the 6th with thirty
--     names and no women on it, and the readership answered the row rather than
--     the festival. A recap about the festival would have been false on its own
--     page.
--  3. NO RECAP IS BETTER THAN A GUESSED ONE. Editions where the honest answer
--     is "a convention happened, as it does every year" are left null. The page
--     already renders that case as measurement, and a sentence written to fill
--     the slot is the "text there to have something there" problem.
--
-- Kept short on purpose. This lands in the masthead above the fold, clamped to
-- two lines on a phone, so it has one sentence to be worth reading.

update public.event_editions e
set recap = v.recap
from (values
  -- ── Angoulême: the Grand Prix is the story every year ──────────────────
  ('angouleme', '2016',
   'Not the festival — the row. The Grand Prix shortlist went out with thirty names and not one woman on it, and within days Sattouf, Sfar and others had pulled themselves off it. The festival changed how the prize is decided.'),
  ('angouleme', '2018',
   'Richard Corben took the Grand Prix, two years after the all-male shortlist forced the festival to rewrite its own rules.'),
  ('angouleme', '2019',
   'Rumiko Takahashi took the Grand Prix — the first manga artist ever to win it, and only the second woman.'),
  ('angouleme', '2020',
   'Emmanuel Guibert took the Grand Prix, at the last Angoulême before the pandemic shut the festival for two years.'),
  ('angouleme', '2023',
   'The fiftieth festival. Riad Sattouf took the Grand Prix — seven years after refusing to stand for it.'),
  ('angouleme', '2024',
   'Posy Simmonds took the Grand Prix, the third woman to win it in fifty-one years.'),

  -- ── the pandemic years, which are the most legible thing in the archive ──
  ('pax', '2020',
   'PAX East, in Boston, and one of the last large conventions held before everything stopped. Sony had already withdrawn over the virus a fortnight beforehand.'),
  ('anime-expo', '2021',
   'Anime Expo Lite — a weekend of streams instead of a show floor. The Los Angeles Convention Center stayed shut.'),
  ('eccc', '2021',
   'Displaced from March to December, and the first Emerald City back in the building since 2019. Proof of vaccination at the door.'),
  ('eccc', '2022',
   'Still off its own calendar — August rather than March — as the convention circuit felt its way back to its usual dates.'),
  ('fan-expo-canada', '2021',
   'Pushed from August to late October and run at reduced capacity, the first Toronto show in two years.'),
  ('dragon-con', '2021',
   'Dragon Con went ahead when most of the circuit had not, with masks and proof of vaccination, and a visibly smaller crowd across the host hotels.'),
  ('lucca', '2021',
   'Lucca Changes gave way to a real festival again, capped and ticketed by time slot, four days instead of the usual five.'),
  ('wondercon', '2022',
   'The first WonderCon in three years, and Comic-Con International''s first in-person show since the shutdown.'),
  ('comiket', '2022',
   'Winter Comiket, back to two days at Tokyo Big Sight — but on advance tickets rather than the overnight queue that used to define it.'),

  -- ── the years where the readership itself is the story ──────────────────
  ('nycc', '2019',
   'The convention ran while Joker opened in cinemas across the city. The readership that week belongs mostly to the film, not to the show floor.'),
  ('lucca', '2024',
   'The sharpest reading in Lucca''s record by a wide margin — sixty-one times its ordinary week, against nine or ten in a normal year.'),
  ('ccxp', '2022',
   'The first full-scale CCXP since 2019, and one of the loudest readings in the archive.'),
  ('ccxp', '2023',
   'São Paulo again at full strength, and again among the largest single readings any event in this archive produces.'),

  -- ── broadcasts, which are a different kind of event ─────────────────────
  ('summer-game-fest', '2023',
   'A two-hour broadcast, and one of the most concentrated readings in the archive — an audience arriving all at once rather than over a weekend.'),
  ('summer-game-fest', '2024',
   'Another single evening, another reading that a multi-day convention never produces: everything happens inside two hours.'),
  ('summer-game-fest', '2025',
   'The showcase without a show floor, and the sharpest spike shape here — near-vertical, because there is no queue to spread it out.'),
  ('summer-game-fest', '2026',
   'The steepest reading of any event in this archive. A broadcast concentrates a year of announcements into one evening.'),
  ('nintendo-direct', '2025',
   'A September Direct, announced a few days ahead as they always are, and over in about forty minutes.'),
  ('nintendo-direct', '2026',
   'A June Direct — the slot Nintendo has used since E3 stopped existing.'),
  ('game-awards', '2025',
   'One December evening in Los Angeles, and the highest multiple in the archive. The Game Awards concentrate more announcements into three hours than most conventions manage in four days.'),

  -- ── venue and format facts, which are checkable ─────────────────────────
  ('gamescom', '2018',
   'Cologne at full size, and the year gamescom''s opening night began behaving like a showcase in its own right rather than a preamble to the floor.'),
  ('gamescom', '2023',
   'Koelnmesse back to its pre-pandemic scale, with Opening Night Live doing most of the announcing.'),
  ('gamescom', '2024',
   'Three days in Cologne, and one of the strongest readings gamescom has produced.'),
  ('gamescom', '2025',
   'The largest gamescom reading on record here, and comfortably the biggest games event in Europe by attendance.'),
  ('comiket', '2019',
   'The first Comiket to run four days rather than three, and the last before the pandemic emptied Tokyo Big Sight.'),
  ('sdcc', '2025',
   'San Diego at full size, and a notably flat reading for it — a convention week that the wider audience did not follow as closely as usual.'),
  ('mcm-london', '2026',
   'The May show at ExCeL, the smaller of MCM''s two London dates.'),
  ('ccxp', '2025',
   'Not December. This window sits in July, well off CCXP''s usual slot, and the reading belongs to whatever moved the article then rather than to the São Paulo show.'),
  ('eccc', '2026',
   'Back in its proper March week in Seattle, for the first time in years without a displaced date.')
) as v(slug, edition_slug, recap)
where e.slug = v.slug and e.edition_slug = v.edition_slug
  and (e.recap is null or length(e.recap) <= 20);
