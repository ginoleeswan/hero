-- Paginate + server-side alignment for hero search.
--
-- Adds alignment_filter + result_limit/result_offset so the Search tab can do
-- correct infinite scroll (alignment must be server-side, else paginated client
-- filtering yields sparse pages). Empty query → publisher/alignment browse (junk
-- publishers excluded); non-empty → alias/typo-tolerant search. Sort gets an id
-- tiebreak so page boundaries are stable.

drop function if exists public.search_heroes(text, text);

create or replace function public.search_heroes(
  search_query text,
  publisher_filter text default 'All',
  alignment_filter text default 'All',
  result_limit int default 30,
  result_offset int default 0
)
returns table (
  id text,
  name text,
  publisher text,
  alignment text,
  image_md_url text,
  image_url text,
  portrait_url text,
  full_name text,
  aliases text[]
)
language sql
stable
as $$
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
      -- exclude junk publishers when browsing (empty query) only
      trim(search_query) <> ''
      or coalesce(h.publisher, '') not in
        ('Non-Fictional', 'In the Public Domain', 'Company-Licensed')
    )
  order by
    (h.name ilike search_query) desc,
    (h.name ilike search_query || '%') desc,
    (h.name ilike '%' || search_query || '%') desc,
    greatest(
      similarity(h.name, search_query),
      similarity(coalesce(h.full_name, ''), search_query)
    ) desc,
    h.issue_count desc nulls last,
    h.id
  limit result_limit offset result_offset;
$$;
