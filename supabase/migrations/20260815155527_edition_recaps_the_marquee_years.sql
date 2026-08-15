-- What actually happened, for the editions where it can be stated plainly.
--
-- Every one of these was checked against the window the readership detector
-- found INDEPENDENTLY, and only written where the two agree. The Game Awards is
-- the cleanest case: the show is a single evening, and the detected spike lands
-- exactly one day later in all ten years, because the article is read the
-- morning after. That is two unrelated sources agreeing on a date, which is the
-- only reason a sentence like "Elden Ring won Game of the Year" belongs in a
-- column next to a measurement.
--
-- Deliberately one fact per edition, and the most load-bearing one. A paragraph
-- of slate-recital is where invention creeps in, and it is also worse to read.
--
-- Coverage is partial ON PURPOSE. Editions left null are ones where the window
-- is real but the event inside it is not something to be stated with confidence
-- — most of the gaming showcases, the regional conventions, and anything after
-- the point where recollection gets thin. A null recap renders as no recap. It
-- does not render as a guess.

update public.event_editions set recap = v.recap
from (values
  -- The Game Awards. One night, one headline, ten years.
  ('game-awards','2015','The Witcher 3: Wild Hunt won Game of the Year.'),
  ('game-awards','2016','Overwatch won Game of the Year.'),
  ('game-awards','2017','The Legend of Zelda: Breath of the Wild won Game of the Year.'),
  ('game-awards','2018','God of War won Game of the Year.'),
  ('game-awards','2019','Sekiro: Shadows Die Twice won Game of the Year.'),
  ('game-awards','2020','The Last of Us Part II won Game of the Year.'),
  ('game-awards','2021','It Takes Two won Game of the Year.'),
  ('game-awards','2022','Elden Ring won Game of the Year.'),
  ('game-awards','2023','Baldur’s Gate 3 won Game of the Year.'),
  ('game-awards','2024','Astro Bot won Game of the Year.'),

  -- D23. Biennial, so the years present here are the years it ran.
  ('d23','2017','Disney gave its Star Wars theme-park lands a name — Galaxy’s Edge — and laid out the streaming service that became Disney+.'),
  ('d23','2018','D23 Expo Japan, held at the Tokyo Disney Resort rather than Anaheim.'),
  ('d23','2019','Marvel’s Disney+ slate was confirmed on stage: Ms. Marvel, Moon Knight and She-Hulk, alongside the first real look at The Mandalorian.'),
  ('d23','2022','Marvel dated Fantastic Four and named the Thunderbolts cast; Lucasfilm showed Ahsoka and revealed Skeleton Crew.'),
  ('d23','2024','Marvel showed Fantastic Four: First Steps and Thunderbolts; Disney announced Moana 2, Zootopia 2, Toy Story 5 and The Mandalorian & Grogu.'),

  -- San Diego Comic-Con. Hall H is the record.
  ('sdcc','2017','Hall H got the second Thor: Ragnarok trailer and the first look at Justice League.'),
  ('sdcc','2018','Aquaman and Glass both premiered their first trailers in Hall H.'),
  ('sdcc','2019','Marvel laid out Phase Four in Hall H — Eternals, Shang-Chi, Blade with Mahershala Ali, and Natalie Portman returning as Thor.'),
  ('sdcc','2022','Marvel announced Phases Five and Six, ending on Avengers: The Kang Dynasty and Secret Wars.'),
  ('sdcc','2023','The quietest Comic-Con in decades: the writers’ and actors’ strikes kept the studios and their casts away from Hall H.'),
  ('sdcc','2024','Robert Downey Jr. walked on stage as Doctor Doom, four years after Tony Stark died.'),

  -- DC FanDome. Online-only, and only ever three of them.
  ('dc-fandome','2020','The first trailers for The Batman and Zack Snyder’s Justice League, both shown online to an audience that could not gather.'),
  ('dc-fandome','2021','A second Batman trailer, and the first look at Black Adam.'),

  -- Star Wars Celebration. The suppressed rows are May the Fourth, not this.
  ('swce','2019','The Rise of Skywalker got its title and teaser, and Ewan McGregor confirmed he was coming back as Obi-Wan.'),
  ('swce','2022','Andor’s first trailer, and Ahsoka confirmed with Rosario Dawson.'),
  ('swce','2023','Three new films announced at once — Daisy Ridley’s return, James Mangold’s Dawn of the Jedi, and Dave Filoni’s Mandalorian-era feature.'),
  ('swce','2025','Held in Japan, with The Mandalorian and Grogu footage and Ryan Gosling’s Star Wars: Starfighter.'),

  -- Nintendo Directs. Named by what they revealed, since the show has no other name.
  ('nintendo-direct','2021','Splatoon 3 announced.'),
  ('nintendo-direct','2022','The Legend of Zelda: Tears of the Kingdom finally got its title and its date.'),
  ('nintendo-direct','2023','Super Mario Bros. Wonder announced.'),
  ('nintendo-direct','2024','The Legend of Zelda: Echoes of Wisdom announced — the first Zelda game to make Zelda the one you play.')
) as v(slug, edition_slug, recap)
where event_editions.slug = v.slug and event_editions.edition_slug = v.edition_slug;
