-- The broad slugs (villain / strongest / most-iconic) still 500'd for anon on a
-- cold cache: their predicates match a large share of the table, so the row
-- source scanned the 109MB heroes heap and blew the 3s statement_timeout.
--
-- An index couldn't help while every branch lived in one CASE expression: the
-- query then *references* every predicate column (including group_affiliation,
-- which is too long to index safely), so no index covers it and an index-only
-- scan is impossible. Same for the search filter — `p_search = '' OR name ILIKE
-- …` references name/full_name even on the empty-search page load that matters.
--
-- So: split the row source into branches that each touch only their own
-- columns, and give the common branch a narrow covering index (~5MB, vs a 109MB
-- heap scan). xmen keeps its own branch — group_affiliation stays out of this
-- index and gets a partial trigram index of its own two migrations along. The
-- search path keeps the old scan, which is fine: it's a keystroke filter, not
-- the page load.
--
-- Measured anon round trip after: villain 0.67s, strongest 0.61s, most-iconic
-- 0.65s — all three were timing out before.
create index if not exists heroes_facet_cov_idx
  on public.heroes (alignment, publisher, gender, powerstats_total, strength, intelligence, category, franchise);

create or replace function public.category_base_rows(p_slug text, p_search text default ''::text)
returns table(publisher text, alignment text, gender text, powerstats_total integer)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_tag text := case p_slug
    when 'anime' then 'anime'
    when 'video-games' then 'video-game'
    when 'horror' then 'horror-icon'
    when 'magic' then 'magic-user'
    when 'aliens' then 'alien'
    when 'mythology' then 'mythological'
  end;
  v_search boolean := p_search <> '';
begin
  -- Tag-backed slugs: driven off hero_tags_tag_idx, never a heroes scan.
  if v_tag is not null then
    if v_search then
      return query
        select h.publisher, h.alignment, h.gender, h.powerstats_total
        from hero_tags ht join heroes h on h.id = ht.hero_id
        where ht.tag = v_tag
          and (h.name ilike '%' || p_search || '%' or h.full_name ilike '%' || p_search || '%');
    else
      return query
        select h.publisher, h.alignment, h.gender, h.powerstats_total
        from hero_tags ht join heroes h on h.id = ht.hero_id
        where ht.tag = v_tag;
    end if;

  -- xmen matches on group_affiliation, which is deliberately not in the
  -- covering index (long free text) — it gets its own branch and its own index.
  elsif p_slug = 'xmen' then
    if v_search then
      return query
        select h.publisher, h.alignment, h.gender, h.powerstats_total
        from heroes h
        where (h.group_affiliation ilike '%x-men%' or h.group_affiliation ilike '%xmen%')
          and (h.name ilike '%' || p_search || '%' or h.full_name ilike '%' || p_search || '%');
    else
      return query
        select h.publisher, h.alignment, h.gender, h.powerstats_total
        from heroes h
        where (h.group_affiliation ilike '%x-men%' or h.group_affiliation ilike '%xmen%');
    end if;

  -- Everything else touches only columns in heroes_facet_cov_idx, so the
  -- empty-search page load can run index-only.
  elsif v_search then
    return query
      select h.publisher, h.alignment, h.gender, h.powerstats_total
      from heroes h
      where
        case p_slug
          when 'popular' then h.category = 'popular'
          when 'villain' then h.alignment = 'bad' and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
          when 'anti-heroes' then h.alignment ilike '%neutral%'
          when 'marvel' then h.publisher ilike '%marvel%'
          when 'dc' then h.publisher ilike '%dc%'
          when 'image' then h.publisher ilike '%image%'
          when 'dark-horse' then h.publisher ilike '%dark horse%'
          when 'strongest' then h.strength is not null
          when 'most-intelligent' then h.intelligence is not null
          when 'most-iconic' then (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed'))
          when 'franchise-icons' then h.franchise is not null
          else true
        end
        and (h.name ilike '%' || p_search || '%' or h.full_name ilike '%' || p_search || '%');
  else
    return query
      select h.publisher, h.alignment, h.gender, h.powerstats_total
      from heroes h
      where
        case p_slug
          when 'popular' then h.category = 'popular'
          when 'villain' then h.alignment = 'bad' and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
          when 'anti-heroes' then h.alignment ilike '%neutral%'
          when 'marvel' then h.publisher ilike '%marvel%'
          when 'dc' then h.publisher ilike '%dc%'
          when 'image' then h.publisher ilike '%image%'
          when 'dark-horse' then h.publisher ilike '%dark horse%'
          when 'strongest' then h.strength is not null
          when 'most-intelligent' then h.intelligence is not null
          when 'most-iconic' then (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed'))
          when 'franchise-icons' then h.franchise is not null
          else true
        end;
  end if;
end;
$function$;
