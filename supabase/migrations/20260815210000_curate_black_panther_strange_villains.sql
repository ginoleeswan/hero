-- These three were in the 20260815110000 tentpole batch but resolved to nothing,
-- because the hero rows did not exist until 20260815170000 created them. Their
-- TMDB credits ("Erik Killmonger", "N'Jobu") only reach the row via alias, and
-- alias matching is deliberately not a rule, so they are curated.
--
-- Note the cascade this causes: adding a curated row changes the set of
-- publishers a title is "established" as, which is the guard the coherence tiers
-- in link_tmdb_cast() consult. Re-running the function after this inserted 4
-- further rows before converging to 0. That is expected — the function is
-- idempotent at a fixed point, not after its own inputs change.
insert into hero_media_appearances (hero_id, title_id, media_type, source, rank)
select h.id, c.title_id, t.media_type, 'curated', round(coalesce(t.vote_average,0)*10)::int
from (values
  ('tmdb:284054','Killmonger'),   -- Black Panther (2018)
  ('tmdb:284054','Nakia'),
  ('tmdb:284052','Kaecilius')     -- Doctor Strange (2016)
) as c(title_id, hero_name)
join titles t on t.id = c.title_id
join lateral (
  select id from heroes
  where lower(name) = lower(c.hero_name) and publisher = 'Marvel'
  order by fame_score desc nulls last limit 1
) h on true
on conflict (hero_id, title_id) do nothing;
