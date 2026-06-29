-- Persist TMDB cast → hero links into hero_media_appearances so the hero-side
-- "On Screen" section is populated from TMDB credits (rich) not just Wikidata
-- (sparse). The data already exists in titles.cast_members; this is the missing
-- write-back. Precision: match ONLY the alias part of a "Civilian Name / Hero
-- Alias" credit (ord >= 2 after splitting on '/'), which is how real comic-movie
-- cast is credited — avoids generic single-name false positives (e.g. an obscure
-- "Skull" hero matching a Simpsons character). Pure SQL, no external API.
-- Reversible: delete from hero_media_appearances where source = 'tmdb_cast'.
create or replace function public.link_tmdb_cast()
  returns integer
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare n integer;
begin
  insert into hero_media_appearances (hero_id, title_id, media_type, source, rank)
  with name_to_hero as (
    -- one hero per exact name: the most famous, so "Warlock" → Adam not the deep cut
    select distinct on (lower(name)) lower(name) as lname, id as hero_id
    from heroes order by lower(name), fame_score desc nulls last
  ),
  cast_seg as (
    select distinct
      t.id as title_id, t.media_type,
      round(coalesce(t.vote_average, 0) * 10)::int as rank,
      lower(btrim(seg.nm)) as lname
    from titles t
    cross join lateral jsonb_array_elements(t.cast_members) c
    cross join lateral unnest(string_to_array(c->>'character', '/')) with ordinality seg(nm, ord)
    where t.cast_members is not null
      and seg.ord >= 2                      -- alias part only
      and length(btrim(seg.nm)) >= 3
  )
  select nh.hero_id, cs.title_id, cs.media_type, 'tmdb_cast', cs.rank
  from cast_seg cs
  join name_to_hero nh on nh.lname = cs.lname
  on conflict (hero_id, title_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
