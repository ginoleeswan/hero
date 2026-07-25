-- Link family-tree relatives to real hero rows where the name resolves
-- unambiguously.
--
-- ~80% of hero_relatives rows were loose text with no character behind them, so
-- they could never show a face, a power badge or a link — the ceiling on how
-- useful a family tree could ever be. This resolves the safe subset (369 -> 665
-- linked rows, 20% -> 37%).
--
-- Three deliberate guards, because a wrong link is worse than no link:
--   1. EXACT case-insensitive name match only. No fuzzy matching.
--   2. Exactly ONE candidate hero. 122 rows matched several and are skipped.
--   3. Same universe when both sides declare one. This blocks real collisions
--      seen in the data (Steel's "Bess" matching a Disney character, Carnage's
--      "Scream" matching the Dark Horse one, Zeus's "Kratos" matching the
--      PlayStation one). It also costs a few correct links where the SUBJECT's
--      publisher is itself mislabelled — an acceptable trade at this ratio.
--
-- Reversible: the same three criteria identify exactly the rows this set.
update public.hero_relatives r
set related_hero_id = m.target
from (
  select u.id, min(h.id) as target
  from (
    select id, hero_id, lower(btrim(name)) as key
    from public.hero_relatives
    where related_hero_id is null and btrim(coalesce(name, '')) <> ''
  ) u
  join public.heroes h on lower(btrim(h.name)) = u.key
  join public.heroes s on s.id = u.hero_id
  where s.publisher is null or h.publisher is null or s.publisher = h.publisher
  group by u.id
  having count(h.id) = 1
) m
where r.id = m.id and r.related_hero_id is null;
