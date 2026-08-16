-- browse_cover_pool answers 'strongest' and 'most-intelligent' from one shared
-- branch that filters and sorts on `case p_slug when 'strongest' then h.strength
-- else h.intelligence end`. A CASE over a parameter is opaque to the planner:
-- it cannot match the expression to any index, so both slugs became a full scan
-- of 50,575 heroes followed by a full sort. Measured at 5,976 ms for one slug —
-- on its own, 6 of the 8.2 seconds get_browse_covers spends across all twelve.
--
-- The other eleven slugs are 2-134 ms each, so this is not a general problem
-- with the pool; it is these two sharing a branch to save six lines.
--
-- Splitting them gives each a literal ORDER BY that an index can serve. The
-- publisher exclusion stays a filter rather than part of the index predicate:
-- it removes very few rows, and keeping the index unconditional on it means the
-- ordered walk stops as soon as it has p_limit matches.

create index if not exists heroes_strength_fame_idx
  on public.heroes (strength desc nulls last, fame_score desc nulls last)
  where strength is not null
    and coalesce(portrait_url, image_md_url, image_url) is not null;

create index if not exists heroes_intelligence_fame_idx
  on public.heroes (intelligence desc nulls last, fame_score desc nulls last)
  where intelligence is not null
    and coalesce(portrait_url, image_md_url, image_url) is not null;

create or replace function public.browse_cover_pool(p_slug text, p_limit integer)
returns table(id text, name text, image_url text, image_md_url text, portrait_url text)
language plpgsql
stable
security definer
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
begin
  if v_tag is not null then
    return query
      select h.id, h.name, h.image_url, h.image_md_url, h.portrait_url
      from hero_tags ht
      join heroes h on h.id = ht.hero_id
      where ht.tag = v_tag
        and coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
      order by h.fame_score desc nulls last
      limit p_limit;

  -- Literal predicate + literal ORDER BY, so heroes_strength_fame_idx applies.
  elsif p_slug = 'strongest' then
    return query
      select h.id, h.name, h.image_url, h.image_md_url, h.portrait_url
      from heroes h
      where h.strength is not null
        and coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
        and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
      order by h.strength desc nulls last, h.fame_score desc nulls last
      limit p_limit;

  elsif p_slug = 'most-intelligent' then
    return query
      select h.id, h.name, h.image_url, h.image_md_url, h.portrait_url
      from heroes h
      where h.intelligence is not null
        and coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
        and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
      order by h.intelligence desc nulls last, h.fame_score desc nulls last
      limit p_limit;

  else
    return query
      select h.id, h.name, h.image_url, h.image_md_url, h.portrait_url
      from heroes h
      where coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
        and case p_slug
          when 'popular' then h.category = 'popular'
          when 'villain' then h.alignment = 'bad' and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
          when 'xmen' then (h.group_affiliation ilike '%x-men%' or h.group_affiliation ilike '%xmen%')
          when 'anti-heroes' then h.alignment ilike '%neutral%'
          when 'marvel' then h.publisher ilike '%marvel%'
          when 'dc' then h.publisher ilike '%dc%'
          when 'image' then h.publisher ilike '%image%'
          when 'dark-horse' then h.publisher ilike '%dark horse%'
          when 'most-iconic' then (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed'))
          when 'franchise-icons' then h.franchise is not null
          else true
        end
      order by h.fame_score desc nulls last
      limit p_limit;
  end if;
end;
$function$;;
