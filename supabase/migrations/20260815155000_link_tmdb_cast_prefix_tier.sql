-- Adds the prefix-stripped tier to link_tmdb_cast(), superseding 20260815140000.
--
-- Two credit shapes were being missed on marquee characters:
--   "Bruce Banner / The Hulk", "Ben Grimm / The Thing", "Oz / The Penguin",
--   "The Riddler", "Barry Allen / The Flash"   -- hero rows are Hulk/Thing/Penguin/…
--   "Detective Jean DeWolff", "Agent Maria Hill", "Commissioner Gordon",
--   "Lt. James Gordon", "Dr. Otto Octavius"    -- honorific in front of the name
--
-- The stripped key is added ALONGSIDE the exact key, never in place of it, so
-- "Doctor Strange" still matches the hero named Doctor Strange before anything
-- is stripped.
--
-- Stripping is only safe with universe coherence attached. Unguarded it yields
-- "capt. storm" -> X-Men's Storm on a DC war film and "mr. toad" -> Nintendo's
-- Toad on a Disney short: removing a prefix leaves a generic residual that
-- happily grabs an unrelated publisher's row. Requiring the title to already
-- link a hero of the same publisher took sampled precision from ~55% to ~90%.
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
      'narrator','mom','dad','mommy','daddy','mother','father','grandma','grandpa',
      'nurse','scientist','doctor','computer','cat','dog','knight','soldier','guard',
      'teacher','student','villager','cop','officer','detective','reporter','waiter',
      'waitress','clerk','driver','bartender','announcer','judge','mayor','pilot',
      'priest','stranger','boy','girl','man','woman','baby','child','kid','captain',
      'professor','host','director','engineer','elder','keeper','sheriff','guy',
      'lady','secretary','assistant','manager','owner','boss','president','general',
      'colonel','sergeant','lieutenant','nun','monk','chef','cook','butler','maid',
      'himself','herself','themselves','various','king','queen','prince','princess',
      'monster','witch','devil','emperor','oracle','adjudicator','matchmaker',
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
    select distinct on (lower(name)) lower(name) as lname, id as hero_id,
           fame_score, publisher
    from heroes order by lower(name), fame_score desc nulls last
  ),
  title_pub as (
    select a.title_id, h.publisher
    from hero_media_appearances a join heroes h on h.id = a.hero_id
    where h.publisher is not null
    group by 1, 2
  ),
  cast_seg as (
    select distinct
      t.id as title_id, t.media_type,
      round(coalesce(t.vote_average, 0) * 10)::int as rank,
      seg.ord,
      array_length(string_to_array(c->>'character', '/'), 1) as n_segs,
      lower(btrim(regexp_replace(seg.nm, '\(.*$', ''))) as k0
    from titles t
    cross join lateral jsonb_array_elements(t.cast_members) c
    cross join lateral unnest(string_to_array(c->>'character', '/')) with ordinality seg(nm, ord)
    where t.cast_members is not null
  ),
  -- exact key plus prefix-stripped alternates; the exact key is always tried first
  seg_keys as (
    select title_id, media_type, rank, ord, n_segs, k0 as lname, true as exact from cast_seg
    union
    select title_id, media_type, rank, ord, n_segs, regexp_replace(k0,'^the ',''), false
      from cast_seg where k0 ~ '^the .'
    union
    select title_id, media_type, rank, ord, n_segs, regexp_replace(k0,'^[a-z ]+?\.? ',''), false
      from cast_seg
     where k0 ~ '^(dr|doctor|detective|agent|lt|lieutenant|commissioner|officer|sgt|sergeant|professor|prof|district attorney)\.? .'
  ),
  eligible as (
    select sk.* from seg_keys sk
    where length(sk.lname) >= 3
      and sk.lname not in (select lname from generic_role)
  )
  select nh.hero_id, e.title_id, e.media_type, 'tmdb_cast', e.rank
  from eligible e
  join name_to_hero nh on nh.lname = e.lname
  where (e.exact and (
           e.ord >= 2
        or (e.ord = 1 and e.n_segs >= 2 and (e.lname like '% %' or nh.fame_score >= 10))
        or (e.n_segs = 1 and e.lname like '% %')
        or (e.n_segs = 1 and e.lname not like '% %' and nh.fame_score >= 20
            and exists (select 1 from title_pub tp
                         where tp.title_id = e.title_id and tp.publisher = nh.publisher))
       ))
     or (not e.exact                       -- prefix-stripped: coherence required, always
         and exists (select 1 from title_pub tp
                      where tp.title_id = e.title_id and tp.publisher = nh.publisher))
  on conflict (hero_id, title_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
