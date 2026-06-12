-- Backfill gender for the most-viewed heroes still missing it, inferred from
-- name + summary (pronouns) / known characters. Powers the category-page gender
-- facet, which is empty for ~2/3 of the catalog. Conservative: genuinely
-- ambiguous/genderless characters (e.g. Phoenix Force) are left null, not guessed.
-- Guarded so an existing gender is never overwritten.

update heroes h set gender = v.gender
from (values
  ('cv-2594','Male'),    -- R2-D2 ("He has been")
  ('cv-2280','Male'),    -- Ramone Dexter (killer)
  ('cv-3561','Female'),  -- Vertigo ("She is able")
  ('cv-2687','Male'),    -- Pee-Wee ("Little brother")
  ('cv-1986','Male'),    -- Charley Hawse
  ('cv-1985','Male'),    -- Greg
  ('cv-3383','Male'),    -- Redeemer ("he has to take the role")
  ('cv-2673','Male'),    -- Bascomb (chauffeur)
  ('cv-1345','Male'),    -- Red Mask (Tim Holt)
  ('cv-4445','Male'),    -- Ord ("He trained")
  ('cv-2060','Female'),  -- Boodikka (female Green Lantern)
  ('cv-2957','Male'),    -- Gene Autry
  ('cv-3418','Female'),  -- Firehawk (Lorraine Reilly, "her")
  ('cv-1434','Male'),    -- Billy ("He was the strongest")
  ('cv-2550','Male'),    -- Copperhead ("his snake suit")
  ('cv-3323','Female'),  -- Firebird (Bonita Juarez, "her")
  ('cv-4569','Male'),    -- Mammomax ("He was killed")
  ('cv-2390','Female'),  -- Crimson Fox (Vivian & Constance, "They")
  ('cv-3634','Female'),  -- Stompa (Female Furies)
  ('cv-2901','Male'),    -- Prime (Kevin Green, "teenage boy")
  ('cv-2227','Male'),    -- Neron (fallen angel, male)
  ('cv-3063','Male'),    -- Shermy (Peanuts)
  ('cv-1337','Female'),  -- Bulletgirl (Susan Kent, "she")
  ('cv-3231','Male'),    -- Brothers Grimm ("brothers")
  ('cv-4572','Male'),    -- Squid-Boy (Sammy Pare, "He idolized")
  ('cv-2946','Male'),    -- Herman (mouse)
  ('cv-3565','Male'),    -- Amphibius ("He has the leg strength")
  ('cv-1968','Male'),    -- Alan M. Mayberry ("He is Josie's boyfriend")
  ('cv-1538','Male'),    -- Jigsaw (Billy Russo, "his face")
  ('cv-2947','Male'),    -- Katnip (male cat)
  ('cv-2119','Female'),  -- Silhouette (Silhouette Chord, "her own")
  ('cv-3729','Female'),  -- Holly Robinson ("She is a former")
  ('cv-3075','Male'),    -- Pegasus (mythic stallion)
  ('cv-2412','Male'),    -- ALF (male)
  ('cv-3335','Male'),    -- Chas Chandler (Francis William, "He is")
  ('cv-3303','Male'),    -- Moe (Moe Howard, Three Stooges)
  ('cv-3559','Male'),    -- Brainchild (Savage Land Mutate, male)
  ('cv-1528','Male'),    -- Tarantula (Antón Rodríguez, "his suicide")
  ('cv-3468','Male'),    -- Tyrannus (roman emperor, "handsome")
  ('cv-3412','Male'),    -- Multiplex ("split himself")
  ('cv-4210','Male'),    -- Straight Arrow ("He rides")
  ('cv-3382','Female'),  -- Nyx ("witch... she... the Queen")
  ('cv-3563','Male'),    -- Barbarus (Savage Land Mutate, male)
  ('cv-4574','Female'),  -- Flare ("Her siblings... She joined")
  ('cv-4904','Male'),    -- Mordru ("he has")
  ('cv-2153','Male'),    -- Uranian (Robert Grayson)
  ('cv-3160','Male'),    -- Nitro ("He is known")
  ('cv-1685','Female'),  -- Arrowette ("a normal girl")
  ('cv-4399','Male'),    -- Frank Drake ("his experiences")
  ('cv-3823','Male'),    -- Bill Gaines (EC editor)
  ('cv-3232','Male'),    -- Controller (Basil Sandhurst)
  ('cv-4234','Female'),  -- Rio Morales (mother of Miles)
  ('cv-1501','Female'),  -- Yellowjacket (Rita DeMara, "She")
  ('cv-1277','Male')     -- Barney
) as v(id, gender)
where h.id = v.id and (h.gender is null or h.gender = '');