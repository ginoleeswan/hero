-- The two ranking tiles (Strongest / Smartest) drew their cover from the most
-- *famous* member of the pool rather than the top-ranked one, so Santa Claus
-- (fame 100, strength 50) fronted "Strongest" and Donald Duck fronted
-- "Smartest" — the tile advertised a ranking it wasn't showing.
--
-- Rank those two pools by their own metric, fame as the tie-break, and drop the
-- non-fictional / public-domain rows the ranking pages never mean to headline.
-- Every other slug keeps pure fame order. Pools become Wonder Woman / Hulk /
-- Superman / Godzilla / Goku and Joker / Iron Man / Lex Luthor / Thanos.
create or replace function public.browse_cover_pool(p_slug text, p_limit integer)
returns table(id text, name text, image_url text, image_md_url text, portrait_url text)
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
  elsif p_slug in ('strongest', 'most-intelligent') then
    return query
      select h.id, h.name, h.image_url, h.image_md_url, h.portrait_url
      from heroes h
      where coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
        and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
        and case p_slug
          when 'strongest' then h.strength is not null
          else h.intelligence is not null
        end
      order by
        (case p_slug when 'strongest' then h.strength else h.intelligence end) desc nulls last,
        h.fame_score desc nulls last
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
$function$;

-- The cached Explore payload embeds browse_covers, so it has to be recomputed
-- for the new ranking pools to reach the page.
select public.refresh_explore_bundle();
