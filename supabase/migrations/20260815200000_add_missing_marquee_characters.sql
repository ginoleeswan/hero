-- Add famous characters the catalogue simply never had, and alias the ones it
-- had under a shorter name.
--
-- These surfaced from the linking work: cast credits on popular titles that
-- resolved to no hero row at all. Miles Morales, Daffy Duck (credited in 21
-- titles), Scooby-Doo, Killmonger and April O'Neil were all absent. ComicVine is
-- the sole ingest, so anyone it never swept is simply not here — this is the
-- "curate the famous few" half of the depth-not-breadth strategy, not a bulk
-- import.
--
-- Every candidate was checked against existing rows first, because a duplicate
-- is far more expensive than a gap here: admin_merge_heroes drops descriptive
-- columns and there is no PITR. That check changed the treatment of three of
-- them — Alura In-Ze, Son Goten and Speedy Gonzales already exist as "Alura",
-- "Goten" and "Speedy", so they get an ALIAS rather than a new row. Likewise the
-- Scooby gang already exists as "Velma"/"Shaggy"/"Daphne", so only Scooby-Doo
-- himself is created.
--
-- comicvine_status defaults to 'pending', so the existing 15-minute ComicVine
-- drain picks these up and fills description/image/first appearance without any
-- further work here. fame_tier is the hand-rated recognisability band that
-- recompute_fame_scores() blends with hard signals; it is set conservatively.

-- 1. Aliases for characters that exist under a shorter name (no new rows).
update heroes set aliases = array_append(coalesce(aliases, '{}'), 'Alura In-Ze')
 where name = 'Alura' and publisher = 'DC Comics'
   and not ('Alura In-Ze' = any(coalesce(aliases, '{}')));

update heroes set aliases = array_append(coalesce(aliases, '{}'), 'Son Goten')
 where name = 'Goten' and publisher = 'Shueisha'
   and not ('Son Goten' = any(coalesce(aliases, '{}')));

update heroes set aliases = array_append(coalesce(aliases, '{}'), 'Speedy Gonzales')
 where name = 'Speedy' and publisher = 'Looney Tunes'
   and not ('Speedy Gonzales' = any(coalesce(aliases, '{}')));

-- 2. Characters with no row at all.
insert into heroes (id, name, publisher, fame_tier, aliases)
select 'h_' || gen_random_uuid(), v.name, v.publisher, v.tier, v.aliases
from (values
  -- Marvel
  ('Miles Morales',           'Marvel',       3, array['Spider-Man','Ultimate Spider-Man','Kid Arachnid']),
  ('May Parker',              'Marvel',       2, array['Aunt May','May Reilly']),
  ('Peni Parker',             'Marvel',       1, array['SP//dr']),
  ('America Chavez',          'Marvel',       2, array['Miss America','Ms. America']),
  ('Killmonger',              'Marvel',       2, array['Erik Killmonger','N''Jadaka','Erik Stevens']),
  ('Nakia',                   'Marvel',       1, array['Malice']),
  ('Kaecilius',               'Marvel',       1, null),
  ('Erik Selvig',             'Marvel',       1, array['Dr. Erik Selvig']),
  -- Teenage Mutant Ninja Turtles
  ('April O''Neil',           'Teenage Mutant Ninja Turtles', 2, null),
  ('Casey Jones',             'Teenage Mutant Ninja Turtles', 2, null),
  -- Looney Tunes
  ('Daffy Duck',              'Looney Tunes', 3, array['Duck Dodgers']),
  ('Foghorn Leghorn',         'Looney Tunes', 2, null),
  ('Marvin the Martian',      'Looney Tunes', 2, array['Marvin Martian']),
  -- Hanna-Barbera (DC-published, matching the existing Shaggy/Velma rows)
  ('Scooby-Doo',              'DC Comics',    3, array['Scooby','Scoobert Doo']),
  ('Yogi Bear',               'DC Comics',    2, null),
  -- Ben 10
  ('Ben Tennyson',            'Ben 10',       2, array['Ben 10']),
  ('Gwen Tennyson',           'Ben 10',       1, array['Lucky Girl']),
  -- Shueisha
  ('Sakura Haruno',           'Shueisha',     2, null),
  -- Square Enix (Fullmetal Alchemist, matching the existing Edward Elric row)
  ('Alphonse Elric',          'Square Enix',  2, null),
  ('Roy Mustang',             'Square Enix',  2, array['Flame Alchemist']),
  ('Riza Hawkeye',            'Square Enix',  1, null),
  ('Winry Rockbell',          'Square Enix',  1, null),
  -- Disney
  ('Oswald the Lucky Rabbit', 'Disney',       1, array['Oswald Rabbit'])
) as v(name, publisher, tier, aliases)
where not exists (
  select 1 from heroes h where lower(h.name) = lower(v.name) and h.publisher = v.publisher
);
