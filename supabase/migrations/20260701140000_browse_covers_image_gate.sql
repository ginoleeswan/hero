-- get_browse_covers: gate candidates to heroes that actually have a usable cover
-- image, so the client's fame-weighted-random pick (which now reaches ~40 deep per
-- category) can never surface a blank/broken tile. Only the image predicate is
-- added; the per-slug CASE still MIRRORS category_facet_counts(p_slug) — keep the
-- two in sync. An unknown slug falls through to ELSE (top heroes overall).
create or replace function public.get_browse_covers(
  p_slugs text[],
  p_per_slug int default 6
)
returns table (
  slug text,
  pos int,
  id text,
  name text,
  image_url text,
  image_md_url text,
  portrait_url text
)
language sql
stable
set search_path = public
as $function$
  select s.slug, c.pos, c.id, c.name, c.image_url, c.image_md_url, c.portrait_url
  from unnest(p_slugs) as s(slug)
  cross join lateral (
    select
      h.id, h.name, h.image_url, h.image_md_url, h.portrait_url,
      row_number() over (order by h.fame_score desc nulls last) as pos
    from heroes h
    where
      coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
      and case s.slug
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
        when 'anime' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'anime')
        when 'video-games' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'video-game')
        when 'horror' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'horror-icon')
        else true
      end
    order by h.fame_score desc nulls last
    limit p_per_slug
  ) c
  order by s.slug, c.pos;
$function$;

grant execute on function public.get_browse_covers(text[], int) to anon, authenticated, service_role;
