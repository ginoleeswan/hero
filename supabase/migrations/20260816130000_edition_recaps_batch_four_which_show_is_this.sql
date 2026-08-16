-- Which show is this, actually?
--
-- Three of the watched events are not one event. PAX is East in Boston and West
-- in Seattle; MCM London runs twice a year; Comiket runs twice a year. The hub
-- listed "PAX" ten times with nothing to tell a reader that half of them are a
-- different convention in a different city, which is the single most useful
-- sentence those pages could carry and needed no research at all — the venue and
-- the date already say it, and the two agree on every row.
--
-- So these recaps are checkable by construction: PAX + Seattle + Labor Day is
-- PAX West, PAX + Boston + spring is PAX East, Comiket in August is the summer
-- show and in December the winter one.
--
-- Same three rules as batch three. Nothing here claims an announcement, an
-- attendance or a headline; where a year genuinely has nothing to distinguish
-- it, it says which show it was and stops.

update public.event_editions e
set recap = v.recap
from (values
  ('pax', '2016', 'PAX West, in Seattle over Labor Day weekend — the original show, and the larger of the two.'),
  ('pax', '2017', 'PAX East, in Boston. The spring show, and the one the industry treats as the season opener.'),
  ('pax', '2018', 'PAX East again, a fortnight later in the calendar than usual.'),
  ('pax', '2019', 'PAX East, in Boston — and a window that overlaps WonderCon by three days, which is why both pages report the same readership.'),
  ('pax', '2022', 'PAX West, back in Seattle at full size for the first time since 2019.'),
  ('pax', '2023', 'PAX East, in Boston, on its usual March weekend.'),
  ('pax', '2024', 'PAX West, in Seattle over Labor Day weekend.'),
  ('pax', '2025', 'PAX East, pushed unusually late — May rather than its habitual March.'),
  ('pax', '2026', 'PAX East, in Boston, back on the March weekend it normally keeps.'),
  ('mcm-london', '2023', 'The October show at ExCeL — the larger of MCM''s two London dates each year.'),
  ('mcm-london', '2024', 'MCM''s autumn London show, the bigger of its two.'),
  ('mcm-london', '2025', 'The October show at ExCeL again, run over four days.'),
  ('comiket', '2015', 'Summer Comiket, three days of August heat at Tokyo Big Sight.'),
  ('comiket', '2016', 'Summer Comiket. Two Comikets run every year, and this is the August one.'),
  ('comiket', '2017', 'Summer Comiket at Tokyo Big Sight, in the middle of Obon week.'),
  ('comiket', '2018', 'Summer Comiket — the August half of the year''s pair.'),
  ('comiket', '2023', 'Summer Comiket, and the first August show run without pandemic capacity limits.'),
  ('comiket', '2024', 'Summer Comiket at Tokyo Big Sight, back to its full pre-pandemic scale.'),
  ('comiket', '2025', 'Winter Comiket, the December half of the pair, running across New Year.')
) as v(slug, edition_slug, recap)
where e.slug = v.slug and e.edition_slug = v.edition_slug
  and (e.recap is null or length(e.recap) <= 20);
