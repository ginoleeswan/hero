-- Second pass over `heroes.movies`: recover the links that the exact-name join
-- in 20260815120000 missed for punctuation reasons alone.
--
-- ComicVine and TMDB punctuate the same film differently often enough to matter:
--   "Batman: The Long Halloween Part Two"  vs  "Batman: The Long Halloween, Part Two"
--   "Pokémon: The Movie 2000"              vs  "Pokémon the Movie 2000"
--   "Star Wars Episode II: Attack of the Clones" vs "Star Wars: Episode II - Attack of the Clones"
--   "Batman vs. Teenage Mutant Ninja Turtles"    vs "Batman vs Teenage Mutant Ninja Turtles"
-- Comparing on an alphanumeric-only key collapses exactly that class of
-- difference and nothing else.
--
-- Guards: the normalised key must still resolve to a single title (`count(*) = 1`),
-- and must be at least 6 characters — short keys are where an aggressive
-- normalisation could plausibly collide two unrelated titles.
insert into hero_media_appearances (hero_id, title_id, media_type, source, rank)
select distinct on (hm.hero_id, tn.title_id)
       hm.hero_id, tn.title_id, t.media_type, 'comicvine',
       round(coalesce(t.vote_average, 0) * 10)::int
from (
  select h.id as hero_id,
         regexp_replace(lower(btrim(m->>'name')), '[^a-z0-9]+', '', 'g') as nkey
  from heroes h cross join lateral unnest(h.movies) m
  where length(btrim(coalesce(m->>'name', ''))) >= 2
) hm
join (
  select regexp_replace(lower(btrim(title)), '[^a-z0-9]+', '', 'g') as nkey,
         min(id) as title_id
  from titles
  group by 1
  having count(*) = 1
) tn on tn.nkey = hm.nkey
join titles t on t.id = tn.title_id
where length(hm.nkey) >= 6
on conflict (hero_id, title_id) do nothing;
