-- Same generic-plan problem as category_facet_counts (see the previous
-- migration), on the covers RPC: the per-slug lateral asks for the top
-- p_per_slug (40) heroes by fame, and for a tag slug the predicate is a
-- correlated EXISTS inside a CASE, so PostgREST's parameterized call seq-scans
-- the 109MB heroes heap per slug — worst for small tags like horror (15
-- members), where it must scan everything to prove there is no 40th. Twelve
-- slugs of that blew the anon 3s statement_timeout, and the search page's
-- browse tiles fell back to initials. (Explore is insulated: it reads the
-- precomputed explore_bundle_cache.)
--
-- Pull the per-slug pool into its own function so the tag branch is an explicit
-- hero_tags join (index-driven, ~200 rows then sort) under any plan. Measured
-- anon round trip for the full 12-slug × 40 payload after: ~0.65s, from 3.5s
-- and intermittent 500s. In-database, all twelve pools total ~52ms warm.
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
          when 'strongest' then h.strength is not null
          when 'most-intelligent' then h.intelligence is not null
          when 'most-iconic' then (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed'))
          when 'franchise-icons' then h.franchise is not null
          else true
        end
      order by h.fame_score desc nulls last
      limit p_limit;
  end if;
end;
$function$;

revoke execute on function public.browse_cover_pool(text, integer) from public;
grant execute on function public.browse_cover_pool(text, integer) to anon, authenticated;

-- Signature and output contract unchanged: rows arrive pos-ascending (fame
-- order) within each slug, which assignBrowseCovers relies on.
create or replace function public.get_browse_covers(p_slugs text[], p_per_slug integer default 6)
returns table(slug text, pos integer, id text, name text, image_url text, image_md_url text, portrait_url text)
language sql
stable
set search_path to 'public'
as $function$
  select s.slug, c.pos::int, c.id, c.name, c.image_url, c.image_md_url, c.portrait_url
  from unnest(p_slugs) as s(slug)
  cross join lateral browse_cover_pool(s.slug, p_per_slug)
    with ordinality as c(id, name, image_url, image_md_url, portrait_url, pos)
  order by s.slug, c.pos;
$function$;
