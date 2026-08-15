-- Backfill hero → title links from the legacy `heroes.movies` array.
--
-- `register_media_match()` already fans these out, but only at the moment a NEW
-- title is matched to a TMDB id. Any hero enriched AFTER its films were already
-- in `titles` never got fanned out, and nothing ever swept the backlog — so
-- 3,501 (hero, title) pairs that ComicVine explicitly asserts were sitting
-- unlinked in a column we already had.
--
-- This is upstream assertion, not inference: ComicVine states "this character
-- appears in this film". The hero side needs no name resolution at all — the
-- array hangs off the hero row, so `h.id` is exact. That makes it structurally
-- safer than any name/alias matcher, which is where the earlier passes had to
-- spend all their precision guards.
--
-- The one genuine ambiguity is the TITLE side: "Wonder Woman" is four different
-- rows (1974 / 1975 / 2009 / 2017) and the array carries no usable year, so a
-- name that resolves to more than one title is SKIPPED rather than guessed —
-- 1,204 entries are deliberately left on the table for that reason.
--
-- source = 'comicvine' matches what register_media_match() writes for the same
-- relationship, so this is a backfill of an existing lane, not a new one.
insert into hero_media_appearances (hero_id, title_id, media_type, source, rank)
select distinct on (hm.hero_id, tt.title_id)
       hm.hero_id, tt.title_id, t.media_type, 'comicvine',
       round(coalesce(t.vote_average, 0) * 10)::int
from (
  select h.id as hero_id, lower(btrim(m->>'name')) as mtitle
  from heroes h cross join lateral unnest(h.movies) m
  where length(btrim(coalesce(m->>'name', ''))) >= 2
) hm
join (
  select lower(btrim(title)) as ltitle, min(id) as title_id
  from titles
  group by lower(btrim(title))
  having count(*) = 1                    -- unambiguous title names only
) tt on tt.ltitle = hm.mtitle
join titles t on t.id = tt.title_id
on conflict (hero_id, title_id) do nothing;
