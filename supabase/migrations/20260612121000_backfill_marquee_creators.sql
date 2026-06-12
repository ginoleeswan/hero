-- Backfill creator credits (and a few missing races) for marquee heroes.
-- Legacy SuperheroAPI-seeded rows never received the `creators` array that
-- ComicVine-enriched rows carry. Values are industry-documented publication
-- credits, alphabetized to match the existing convention. Guarded so only
-- NULL columns are filled.

update heroes h
set creators = v.creators
from (values
  ('63',  array['Carmine Infantino','Gardner Fox']),
  ('112', array['Gene Colan','Marv Wolfman']),
  ('156', array['Bill Parker','C. C. Beck']),
  ('157', array['Gene Colan','Roy Thomas']),
  ('162', array['David Michelinie','Mark Bagley']),
  ('196', array['Jack Kirby','Stan Lee']),
  ('204', array['Jack Kirby']),
  ('251', array['Gene Colan','Stan Lee']),
  ('263', array['Carmine Infantino','Robert Kanigher']),
  ('274', array['Chris Claremont','Jim Lee']),
  ('280', array['Gary Friedrich','Mike Ploog','Roy Thomas']),
  ('298', array['George Papp','Mort Weisinger']),
  ('303', array['Dick Ayers','Jack Kirby','Stan Lee']),
  ('309', array['Bruce Timm','Paul Dini']),
  ('322', array['Mike Mignola']),
  ('333', array['Jack Kirby','Stan Lee']),
  ('344', array['Jack Kirby','Stan Lee']),
  ('345', array['Gil Kane','Roy Thomas']),
  ('361', array['Brian Michael Bendis','Michael Gaydos']),
  ('370', array['Bill Finger','Bob Kane','Jerry Robinson']),
  ('374', array['Jack Kirby','Stan Lee']),
  ('391', array['John Romita Sr.','Stan Lee']),
  ('405', array['Jerry Siegel','Joe Shuster']),
  ('416', array['Archie Goodwin','George Tuska','John Romita Sr.']),
  ('432', array['Joe Certa','Joseph Samachson']),
  ('470', array['Don Perlin','Doug Moench']),
  ('490', array['Dave Cockrum','Len Wein']),
  ('491', array['George Pérez','Marv Wolfman']),
  ('527', array['Jack Kirby','Stan Lee']),
  ('530', array['Gerry Conway','John Romita Sr.','Ross Andru']),
  ('538', array['Dennis O''Neil','Neal Adams']),
  ('550', array['Jack Kirby','Joe Simon']),
  ('561', array['Bill Finger','Bob Kane','Jerry Robinson']),
  ('566', array['Bill Mantlo','Keith Giffen']),
  ('567', array['Chris Claremont','Michael Golden']),
  ('579', array['Jack Kirby','Stan Lee']),
  ('589', array['John Buscema','Stan Lee']),
  ('598', array['Jack Kirby','Stan Lee']),
  ('612', array['Todd McFarlane']),
  ('638', array['Dave Cockrum','Len Wein']),
  ('658', array['Jack Kirby','Stan Lee']),
  ('659', array['Jack Kirby','Larry Lieber','Stan Lee']),
  ('680', array['John Buscema','Roy Thomas']),
  ('697', array['John Buscema','Roy Thomas']),
  ('703', array['Bob Layton','David Michelinie','John Byrne']),
  ('714', array['Ed Brubaker','Steve Epting']),
  ('730', array['Gardner Fox','Murphy Anderson'])
) as v(id, creators)
where h.id = v.id and h.creators is null;

-- Missing races (certain from canon).
update heroes set race = 'Mutant' where id in ('490','567') and race is null;
update heroes set race = 'Human'  where id = '550' and race is null;
