-- Twelve editions, researched rather than inferred.
--
-- Batch three wrote what could be said honestly from general knowledge and left
-- the rest null on the rule that no recap beats a guessed one. This batch went
-- and looked. Every line below is a checkable fact from contemporaneous
-- reporting — an announcement made, a ticket count published, a guest who
-- signed — and each was matched against the edition's STORED window before it
-- was written, so no recap describes a weekend the page is not about.
--
-- Sources are the trade and local press for each event: ABC News and The Direct
-- for D23 2026, Marvel and Forbes for SDCC 2026, Den of Geek and RX Global for
-- the NYCC years, Anime Corner for Anime Expo, Variety and the festival's own
-- archive for Lucca's ticket counts, KING 5 for Emerald City, CBC for Fan Expo
-- Canada, and Atlanta News First for Dragon Con's charity total.
--
-- Two of them are worth calling out as editorial finds rather than lookups:
--
--   Fan Expo Canada is not an announcements convention. Its 2024 recap is a
--   guest list because that is genuinely what the show is — a hundred thousand
--   people came to meet Simu Liu and Rosario Dawson, not to hear a slate. A
--   recap claiming otherwise would be the same category error as calling the
--   readership section "who it moved".
--
--   Dragon Con's own measure is the parade and the charity total, not panels.
--   $320,000 for NAMI Georgia and the 25th march down Peachtree is what that
--   convention reports about itself, so it is what its page says.
--
-- 32 editions remain without one. They are the mid-2010s years of the regional
-- conventions, where contemporaneous coverage is thin enough that anything I
-- wrote would be reconstruction. Those pages fall back to the derived
-- readership line, which is true on every one of them.

update public.event_editions e
set recap = v.recap
from (values
  ('d23', '2026',
   'Marvel finally named the X-Men — Adam Driver among them, as Mister Sinister. Lucasfilm answered with an Ahsoka season two trailer and a first look at Star Wars: Starfighter, and Disney Animation confirmed a third Zootopia.'),
  ('sdcc', '2026',
   'Ryan Gosling was revealed as Ghost Rider, Ryan Coogler dated Black Panther 3 to December 2028, and Robert Downey Jr. spent Hall H hinting which heroes join Doom.'),
  ('nycc', '2024',
   'DC brought Vertigo back — the imprint behind Sandman and Hellblazer — and Charlie Cox and Vincent D''Onofrio turned up unannounced with footage from Daredevil: Born Again. Over 200,000 people came through the Javits Center.'),
  ('nycc', '2025',
   'Over 250,000 attendees, and Marvel used the weekend to announce the end of its own Ultimate Universe. DC countered with Absolute Catwoman and the return of 100 Bullets.'),
  ('anime-expo', '2025',
   'MAPPA brought the Chainsaw Man: Reze Arc trailer and Science SARU revealed its Ghost in the Shell series, in a week that also dated new seasons of Frieren, Re:ZERO and Bleach.'),
  ('gamescom', '2022',
   'Opening Night Live finally confirmed Dead Island 2 was real after eight years of silence, alongside world premieres for Dead Island, Lies of P and the DualSense Edge.'),
  ('lucca', '2022',
   'The all-time attendance record for the festival: 319,926 tickets across five days inside the city walls.'),
  ('lucca', '2023',
   '314,220 tickets — a few thousand short of the previous year''s record — with Frank Miller, Jim Lee and Michel Gondry among those signing in the Palazzo delle Dediche.'),
  ('ccxp', '2024',
   'The tenth CCXP, across 115,000 square metres of the São Paulo Expo, where Crunchyroll took the theatrical rights to Attack on Titan: The Last Attack.'),
  ('eccc', '2025',
   'Around 90,000 people over four days — the largest Emerald City on record.'),
  ('fan-expo-canada', '2024',
   'Over 100,000 through the Metro Toronto Convention Centre, for a guest list rather than a slate: Simu Liu, Rosario Dawson, Giancarlo Esposito and Marisa Tomei signing across four days.'),
  ('dragon-con', '2025',
   '75,000 people, the 25th parade down Peachtree Street, and a record $320,000 raised for NAMI Georgia — which is the measure Dragon Con actually keeps.')
) as v(slug, edition_slug, recap)
where e.slug = v.slug and e.edition_slug = v.edition_slug
  and (e.recap is null or length(e.recap) <= 20);
