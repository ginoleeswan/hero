-- Eighteen hub pages were explaining our crawler instead of the event.
--
-- watched_events.blurb was set for exactly two events, d23 and sdcc. The other
-- eighteen fell through to EventHub's hardcoded fallback, so the reader met the
-- same paragraph on every one of them:
--
--   "No calendar told us about this. Each edition below was detected from
--    readership on the event's own Wikipedia article, then frozen before the
--    next one overwrote it."
--
-- That is a true and quite interesting sentence about how the app works, and it
-- is the wrong thing to say in the one slot on the page that should answer
-- "what IS Angoulême". Methodology is a footnote; the reader arrived for the
-- subject. It is the same defect as the "Detected event" eyebrow, in prose.
--
-- Written to the two that already existed: what the event is, where and when it
-- runs, and the one thing that distinguishes it from the other nineteen. No
-- superlatives that are not literally true — "largest in the southern
-- hemisphere" is a fact about CCXP, "unmissable" is not a fact about anything.

update public.watched_events e
set blurb = v.blurb
from (values
  ('angouleme',
   'Europe''s oldest and largest comics festival, held across a small French town every January. Its Grand Prix is the nearest thing the medium has to a lifetime achievement award, and much of what it crowns never reaches English shelves.'),
  ('anime-expo',
   'North America''s largest anime convention, in Los Angeles over the Fourth of July weekend. Where Japanese studios tend to announce their next seasons to a Western audience first.'),
  ('ccxp',
   'Comic Con Experience, in São Paulo each December — the largest convention in the southern hemisphere, and one Hollywood studios fly full casts to.'),
  ('comiket',
   'Comic Market, in Tokyo, twice a year. The largest gathering of self-published work anywhere: hundreds of thousands of people, and almost all of it doujinshi rather than trade.'),
  ('dc-fandome',
   'DC''s all-digital showcase, run in 2020 and 2021 when conventions could not happen. No show floor and no queues — a broadcast, and the whole DC slate in one sitting.'),
  ('dragon-con',
   'Atlanta''s Labor Day convention, spread across downtown hotels rather than one hall. Older and stranger than the trade shows, and far more about fandom than about announcements.'),
  ('eccc',
   'Emerald City Comic Con, in Seattle each spring. The largest in the Pacific Northwest, and one of the few big shows still weighted toward comics rather than film.'),
  ('fan-expo-canada',
   'Toronto''s summer convention and the biggest in Canada, anchoring the Fan Expo circuit that now runs in a dozen North American cities.'),
  ('game-awards',
   'A December ceremony in Los Angeles that is part awards show and part trailer showcase. More games are announced here than are given prizes.'),
  ('gamescom',
   'Europe''s largest games trade fair, in Cologne every August, and bigger by attendance than E3 ever was. Its opening night is a trailer showcase in its own right.'),
  ('lucca',
   'Lucca Comics & Games, held inside the walls of a Tuscan city each autumn. Europe''s largest after Angoulême, and the crowd fills the streets rather than a hall.'),
  ('mcm-london',
   'MCM Comic Con at ExCeL London, twice a year. Britain''s largest, and weighted toward anime, games and television as much as comics.'),
  ('nintendo-direct',
   'Nintendo''s own broadcast — no venue, no fixed schedule, announced a few days ahead and over in about forty minutes. The only place Nintendo says anything.'),
  ('nycc',
   'New York Comic Con, at the Javits Center each October. The largest on the American east coast, and the one publishers use for comics news rather than film.'),
  ('pax',
   'Penny Arcade Expo — several shows under one name. East runs in Boston, West in Seattle, and both are built for people who play rather than for the trade.'),
  ('summer-game-fest',
   'A June showcase in Los Angeles built to fill the gap E3 left. A run of trailers rather than a show floor.'),
  ('swce',
   'Star Wars Celebration, run by Lucasfilm and moved country to country — Chicago, Anaheim, London, Chiba. The only event where Star Wars announces Star Wars.'),
  ('wondercon',
   'Comic-Con International''s spring show, in Anaheim. Smaller and calmer than San Diego, run by the same organisation.')
) as v(slug, blurb)
where e.slug = v.slug;
