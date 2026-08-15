-- Add the live-action tier to link_tmdb_cast().
--
-- The previous rules were tuned on ANIMATED credits, where one actor voices
-- several parts and TMDB writes "Batman / Bruce Wayne / Narrator". That shape
-- made the split-segment rules productive and let the single-segment rule demand
-- a multi-word name for safety.
--
-- Live action does not credit that way. One actor plays one character, so the
-- whole credit is a bare name: Supergirl (2026) ships as
--   ["Supergirl","Ruthye","Krem","Lobo","Zor-El","Alura In-Ze","Superman", …]
-- and every single-word entry there — Lobo, Superman, Zor-El — was excluded by
-- the multi-word requirement. The rule was silently skipping live action.
--
-- A bare single word is genuinely dangerous on its own: fame ranking alone gives
-- "Luigi" → Cars, "Bishop" → Aliens, "Kirby" → a 1945 Western, "Leonardo" → a
-- da Vinci documentary. Fame makes those WORSE, because the famous character is
-- exactly the one that wins the collision.
--
-- The guard that actually works is universe coherence: accept a bare single-word
-- credit only when the title ALREADY has a link to a hero of the same publisher.
-- Supergirl already carries Lucy Lane and Jimmy Olsen (DC), so DC's Lobo is
-- admissible there, while Nintendo's Luigi is not admissible on Cars. Stacked
-- with the generic-role blocklist and a fame floor of 20, sampled precision is
-- ~95% versus ~70% for fame ranking alone.
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
  -- publishers a title is already established as belonging to, via any existing link
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
  where e.ord >= 2                                              -- alias segment
     or (e.ord = 1 and e.n_segs >= 2                            -- lead/first segment
         and (e.lname like '% %' or nh.fame_score >= 10))
     or (e.n_segs = 1 and e.lname like '% %')                   -- unsplit multi-word credit
     or (e.n_segs = 1 and e.lname not like '% %'                -- LIVE ACTION: bare single word
         and nh.fame_score >= 20
         and exists (select 1 from title_pub tp
                      where tp.title_id = e.title_id
                        and tp.publisher = nh.publisher))
  on conflict (hero_id, title_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
