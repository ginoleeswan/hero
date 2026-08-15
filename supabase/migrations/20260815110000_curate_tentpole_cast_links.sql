-- Hand-curated hero → title links for tentpole films, filling the gap that no
-- amount of matcher-widening can reach: `titles.cast_members` only ever holds
-- TMDB's TOP-TEN billing, so an ensemble film is structurally capped at ten
-- linked heroes. The characters that fall off the end are not minor — they are
-- the ones below the leads in billing order, which is why the catalogue had
-- The Dark Knight with no Joker, The Dark Knight Rises with no Bane, The
-- Avengers with no Hulk, Guardians with no Rocket or Nebula, Age of Ultron with
-- no Ultron, and Thor: Ragnarok with no Hela or Valkyrie.
--
-- Resolution is constrained by BOTH name and publisher, never by fame alone.
-- Fame-only resolution is actively wrong here and was caught doing it: "Whiplash"
-- ranks to a Mattel toy, "Grandmaster" to a DC character, "Ajax" to the Greek
-- hero, "Weasel" to a Game of Thrones character. Those four resolve to nothing
-- under the publisher constraint and are therefore absent from this list rather
-- than silently pointed at the wrong row.
--
-- source = 'curated' is deliberate and durable: link_tmdb_cast() is insert-only
-- with `on conflict (hero_id, title_id) do nothing`, and no function in the
-- schema deletes or truncates hero_media_appearances, so the nightly cron can
-- never overwrite or remove these rows.
insert into hero_media_appearances (hero_id, title_id, media_type, source, rank)
select h.id, c.title_id, t.media_type, 'curated',
       round(coalesce(t.vote_average, 0) * 10)::int
from (values
  -- Marvel
  ('tmdb:1726','Iron Monger','Marvel'),                                    -- Iron Man (2008)
  ('tmdb:10138','Black Widow','Marvel'),('tmdb:10138','War Machine','Marvel'), -- Iron Man 2
  ('tmdb:68721','Mandarin','Marvel'),                                      -- Iron Man 3
  ('tmdb:1771','Winter Soldier','Marvel'),('tmdb:1771','Arnim Zola','Marvel'), -- The First Avenger
  ('tmdb:100402','Sharon Carter','Marvel'),('tmdb:100402','Arnim Zola','Marvel'), -- The Winter Soldier
  ('tmdb:271110','Sharon Carter','Marvel'),                                -- Civil War
  ('tmdb:284054','Shuri','Marvel'),                                        -- Black Panther
  ('tmdb:118340','Rocket Raccoon','Marvel'),('tmdb:118340','Nebula','Marvel'),  -- Guardians of the Galaxy
  ('tmdb:10195','Sif','Marvel'),('tmdb:10195','Frigga','Marvel'),('tmdb:10195','Laufey','Marvel'), -- Thor
  ('tmdb:284053','Hela','Marvel'),('tmdb:284053','Valkyrie','Marvel'),('tmdb:284053','Korg','Marvel'), -- Ragnarok
  ('tmdb:24428','Hulk','Marvel'),                                          -- The Avengers
  ('tmdb:99861','Ultron','Marvel'),                                        -- Age of Ultron
  ('tmdb:315635','Ned Leeds','Marvel'),                                    -- Homecoming
  ('tmdb:634649','Lizard','Marvel'),                                       -- No Way Home
  -- DC
  ('tmdb:155','Joker','DC Comics'),                                        -- The Dark Knight
  ('tmdb:49026','Bane','DC Comics'),                                       -- The Dark Knight Rises
  ('tmdb:297761','Joker','DC Comics'),('tmdb:297761','El Diablo','DC Comics'),
  ('tmdb:297761','Captain Boomerang','DC Comics'),                         -- Suicide Squad
  ('tmdb:297762','Doctor Poison','DC Comics')                              -- Wonder Woman (2017)
) as c(title_id, hero_name, pub)
join titles t on t.id = c.title_id
join lateral (
  select h.id from heroes h
  where lower(h.name) = lower(c.hero_name) and h.publisher = c.pub
  order by h.fame_score desc nulls last
  limit 1
) h on true
on conflict (hero_id, title_id) do nothing;
