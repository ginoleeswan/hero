-- Soften the one over-precise claim the accuracy audit found.
--
-- An audit of the 242 blurbs written before batch 06 checked every hard
-- citation in the corpus: 2 issue numbers, 9 years, 3 ordinal positions. All but
-- one hold up (Avengers #2 and #4, Red Skull 1941, Falcon 1969, Joker 1940 /
-- Penguin 1941, Bowser 1985, Steamboat Willie 1928, Spider-Man/Deadpool 2016).
--
-- The survivor asserted Ben Parker is "dead by the eleventh page of Amazing
-- Fantasy #15". The story runs eleven pages, so the claim is arguable rather
-- than wrong — which is precisely the problem. The page number was decoration
-- carrying risk for no gain, and the relationship reads better without it.
--
-- This is the change of principle the rest of the batches now follow: a blurb
-- may be SPECIFIC without being PRECISE.

update public.hero_relationship_blurbs
set blurb = 'Ben Parker is killed by a burglar Peter could have stopped minutes earlier and chose not to, in the same story that gives him his powers. Everything the character has done since is an argument with a man who is not there.'
where hero_a = '620' and hero_b = 'cv-3114';
