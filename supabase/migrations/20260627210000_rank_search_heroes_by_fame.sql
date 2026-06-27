-- Search relevance: rank search_heroes by blended match-tier + fame_score.
--
-- The previous ordering (… similarity → issue_count) buried famous heroes:
-- trigram similarity to "super" was higher for short junk ("Super-Rex") than for
-- "Superman", and similarity sat above popularity. Literal exact matches ("Spider")
-- also dominated far-more-famous prefix matches ("Spider-Man").
--
-- New score = match_tier * 40 + fame_score (0-100): a vastly-more-famous result can
-- jump one match tier, while a better match still wins between equally-famous names.
-- fame_score is 100% populated and well-calibrated (Superman 100, Spider-Man 100).

create or replace function public.search_heroes(
  search_query text,
  publisher_filter text default 'All'::text,
  alignment_filter text default 'All'::text,
  result_limit integer default 30,
  result_offset integer default 0
)
returns table(
  id text, name text, publisher text, alignment text,
  image_md_url text, image_url text, portrait_url text,
  full_name text, aliases text[]
)
language sql
stable
set search_path to 'public'
as $function$
  select
    h.id, h.name, h.publisher, h.alignment, h.image_md_url, h.image_url,
    h.portrait_url, h.full_name, h.aliases
  from public.heroes h
  where
    (
      trim(search_query) = ''
      or h.name ilike '%' || search_query || '%'
      or h.full_name ilike '%' || search_query || '%'
      or public.heroes_aliases_text(h.aliases) ilike '%' || search_query || '%'
      or h.name % search_query
      or coalesce(h.full_name, '') % search_query
    )
    and (
      publisher_filter = 'All'
      or (publisher_filter = 'Marvel' and h.publisher ilike '%marvel%')
      or (publisher_filter = 'DC' and h.publisher ilike '%dc%')
      or (
        publisher_filter = 'Other'
        and coalesce(h.publisher, '') not ilike '%marvel%'
        and coalesce(h.publisher, '') not ilike '%dc%'
      )
    )
    and (alignment_filter = 'All' or h.alignment = alignment_filter)
    and (
      trim(search_query) <> ''
      or coalesce(h.publisher, '') not in
        ('Non-Fictional', 'In the Public Domain', 'Company-Licensed')
    )
  order by
    (
      case
        when h.name ilike search_query then 4
        when h.name ilike search_query || '%' then 3
        when h.name ilike '%' || search_query || '%' then 2
        when coalesce(h.full_name, '') ilike '%' || search_query || '%'
          or public.heroes_aliases_text(h.aliases) ilike '%' || search_query || '%' then 1.5
        else 1
      end
    ) * 40 + coalesce(h.fame_score, 0) desc,
    h.issue_count desc nulls last,
    h.id
  limit result_limit offset result_offset;
$function$;
