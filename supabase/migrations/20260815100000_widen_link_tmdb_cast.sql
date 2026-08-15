-- Widen link_tmdb_cast() coverage. The original matched ONLY the alias segment
-- (ord >= 2) of a "Civilian Name / Hero Alias" credit, which left three large
-- seams of already-fetched titles.cast_members data unused:
--
--   1. The FIRST segment of a multi-segment credit. "Batman / Bruce Wayne" linked
--      Bruce Wayne but not Batman; "Jean Grey / Dark Phoenix" linked Dark Phoenix
--      but not Jean Grey. In an animated comic film the first segment is almost
--      always the headline character, so this was the most valuable miss.
--   2. Single-segment credits ("Severus Snape", "Jason Voorhees") — skipped
--      wholesale by the ord >= 2 rule, even when unambiguous.
--   3. Credits carrying a parenthetical suffix. "Rath (voice)" never matched the
--      hero named "Rath" because the suffix was never stripped.
--
-- Precision is held by three guards, each calibrated against sampled output:
--   * a bare single-word segment is trusted only as a first segment AND only for
--     a hero with fame_score >= 10 (sampled junk topped out at 2, the lowest
--     true positive was 21), because a lone common noun is where false matches
--     come from;
--   * a single-segment credit must be multi-word, which is self-disambiguating;
--   * generic role nouns are blocked outright — TMDB credits thousands of
--     "Narrator" / "Scientist" / "Mom" parts, and this catalogue happens to
--     contain hero rows by those exact names.
--
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
  with generic_role as (
    select unnest(array[
      -- bare role nouns
      'narrator','mom','dad','mommy','daddy','mother','father','grandma','grandpa',
      'nurse','scientist','doctor','computer','cat','dog','knight','soldier','guard',
      'teacher','student','villager','cop','officer','detective','reporter','waiter',
      'waitress','clerk','driver','bartender','announcer','judge','mayor','pilot',
      'priest','stranger','boy','girl','man','woman','baby','child','kid','captain',
      'professor','host','director','engineer','elder','keeper','sheriff','guy',
      'lady','secretary','assistant','manager','owner','boss','president','general',
      'colonel','sergeant','lieutenant','nun','monk','chef','cook','butler','maid',
      'himself','herself','themselves','various',
      -- article-led / qualified generics
      'the queen','the king','the old man','old man','young man','old woman',
      'young woman','the man','the woman','the boy','the girl','the kid','the baby',
      'the child','the director','the engineer','the ceo','the elder','the host',
      'the keeper','the sheriff','the narrator','the stranger','the priest',
      'the nurse','the mother','the father','queen mother','bad cop','smiling man',
      'the guard','the teacher','the driver','the waiter','the clerk','the reporter',
      'the bartender','the announcer','the judge','the mayor','the soldier',
      'the pilot','the assistant','the secretary','the manager','the owner',
      'the boss','the president','the doctor','additional voices'
    ]) as lname
  ),
  name_to_hero as (
    -- one hero per exact name: the most famous, so "Warlock" → Adam not the deep cut
    select distinct on (lower(name)) lower(name) as lname, id as hero_id, fame_score
    from heroes order by lower(name), fame_score desc nulls last
  ),
  cast_seg as (
    select distinct
      t.id as title_id, t.media_type,
      round(coalesce(t.vote_average, 0) * 10)::int as rank,
      seg.ord,
      array_length(string_to_array(c->>'character', '/'), 1) as n_segs,
      -- drop "(voice)", "(uncredited)" and friends before matching
      lower(btrim(regexp_replace(seg.nm, '\(.*$', ''))) as lname
    from titles t
    cross join lateral jsonb_array_elements(t.cast_members) c
    cross join lateral unnest(string_to_array(c->>'character', '/')) with ordinality seg(nm, ord)
    where t.cast_members is not null
  ),
  eligible as (
    select cs.* from cast_seg cs
    where length(cs.lname) >= 3
      and cs.lname not in (select lname from generic_role)
  )
  select nh.hero_id, e.title_id, e.media_type, 'tmdb_cast', e.rank
  from eligible e
  join name_to_hero nh on nh.lname = e.lname
  where e.ord >= 2                                             -- alias segment (original rule)
     or (e.ord = 1 and e.n_segs >= 2                           -- lead/first segment
         and (e.lname like '% %' or nh.fame_score >= 10))
     or (e.n_segs = 1 and e.lname like '% %')                  -- unsplit multi-word credit
  on conflict (hero_id, title_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
