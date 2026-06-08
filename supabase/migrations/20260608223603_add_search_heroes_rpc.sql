-- Mature hero search: alias-aware + typo-tolerant, ranked server-side.
--
-- Replaces the old client pattern (ilike name/full_name → fetch 100 → rank in JS),
-- which (a) never searched aliases at the DB level and (b) had zero typo tolerance.
-- pg_trgm gives fuzzy matching AND lets ilike '%q%' use a GIN index instead of a
-- full scan.

create extension if not exists pg_trgm;

-- array_to_string is only STABLE, so it can't be used directly in an index
-- expression. This thin IMMUTABLE wrapper makes the aliases trigram index legal
-- (and is used in the query too so the index is actually hit).
create or replace function public.heroes_aliases_text(arr text[])
returns text
language sql
immutable
as $$
  select array_to_string(arr, ' ')
$$;

-- Trigram GIN indexes — power both fuzzy (`%`) and substring (ilike '%q%') search.
create index if not exists heroes_name_trgm_idx
  on public.heroes using gin (name gin_trgm_ops);
create index if not exists heroes_full_name_trgm_idx
  on public.heroes using gin (full_name gin_trgm_ops);
create index if not exists heroes_aliases_trgm_idx
  on public.heroes using gin (public.heroes_aliases_text(aliases) gin_trgm_ops);

-- Returns the HeroSearchResult column subset, ranked: exact name → name prefix →
-- name contains → trigram similarity → issue_count. Recall covers name, full_name,
-- aliases (nicknames like "Spidey", "Cap", "Logan") and fuzzy typo matches.
create or replace function public.search_heroes(
  search_query text,
  publisher_filter text default 'All'
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
      h.name ilike '%' || search_query || '%'
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
  order by
    (h.name ilike search_query) desc,                    -- exact (case-insensitive)
    (h.name ilike search_query || '%') desc,             -- prefix
    (h.name ilike '%' || search_query || '%') desc,      -- contains
    greatest(
      similarity(h.name, search_query),
      similarity(coalesce(h.full_name, ''), search_query)
    ) desc,                                              -- fuzzy closeness
    h.issue_count desc nulls last                        -- popularity tiebreak
  limit 100;
$$;
