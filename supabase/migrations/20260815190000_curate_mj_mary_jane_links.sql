-- "MJ" is credited as the entire character name across the Holland-era Spider-Man
-- films, and the matcher structurally cannot reach it: it is 2 characters (below
-- the length floor that stops initials matching noise) and it lives in
-- heroes.aliases rather than heroes.name. General alias matching was measured at
-- only ~75-80% precision and is deliberately NOT a rule -- see the note in
-- docs/architecture/data-pipelines.md -- so this is curated instead.
--
-- Scoped narrowly: only titles that already carry a Marvel link, so it cannot
-- reach a same-named character in another universe.
insert into hero_media_appearances (hero_id, title_id, media_type, source, rank)
select h.id, t.id, t.media_type, 'curated', round(coalesce(t.vote_average,0)*10)::int
from titles t
cross join lateral (select id from heroes where name = 'Mary Jane' and publisher = 'Marvel'
                    order by fame_score desc nulls last limit 1) h
where t.cast_members is not null
  and exists (select 1 from jsonb_array_elements(t.cast_members) c
               where lower(btrim(c->>'character')) = 'mj')
  and exists (select 1 from hero_media_appearances a join heroes h2 on h2.id=a.hero_id
               where a.title_id = t.id and h2.publisher = 'Marvel')
on conflict (hero_id, title_id) do nothing;
