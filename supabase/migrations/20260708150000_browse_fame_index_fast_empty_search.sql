-- The opponent picker and Search tab open on an EMPTY query (browse = top heroes
-- by fame). That path was a 6.7s full seq-scan of ~35k rows + top-N heapsort:
-- the fame-primary CASE in ORDER BY is non-indexable, so every browse re-sorted
-- the whole table. For an empty query the CASE collapses to a constant per fame
-- tier, so it's pure overhead — the real order is just fame_score, issue_count, id.
--
-- Fix: a partial btree index in exactly that browse order (junk publishers
-- excluded, matching the default 'All' browse predicate), and a plpgsql branch so
-- the empty path runs a plain indexable ORDER BY (index scan, ~3ms) while real
-- searches keep the fame-primary CASE. A single SQL body can't do this: a
-- constant leading CASE key still can't be proved constant at plan time (the
-- query text is a parameter), so the planner sorts the whole table anyway.
-- Signature + return shape unchanged.

create index if not exists heroes_browse_fame_idx
  on public.heroes (fame_score desc nulls last, issue_count desc nulls last, id)
  where coalesce(publisher, '') not in
    ('Non-Fictional', 'In the Public Domain', 'Company-Licensed');

create or replace function public.search_heroes(
  search_query text,
  publisher_filter text default 'All',
  alignment_filter text default 'All',
  result_limit integer default 30,
  result_offset integer default 0
)
returns table(
  id text, name text, publisher text, alignment text,
  image_md_url text, image_url text, portrait_url text,
  full_name text, aliases text[], fame_score integer
)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  q text := trim(search_query);
begin
  -- ── Empty browse: top heroes by fame. Plain ORDER BY served by the partial
  --    heroes_browse_fame_idx as an index scan (no full sort). Publisher/alignment
  --    facets still apply; the junk-publisher exclusion matches the index predicate.
  if q = '' then
    return query
      select
        h.id, h.name, h.publisher, h.alignment, h.image_md_url, h.image_url,
        h.portrait_url, h.full_name, h.aliases, h.fame_score::integer
      from public.heroes h
      where
        (
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
        and coalesce(h.publisher, '') not in
          ('Non-Fictional', 'In the Public Domain', 'Company-Licensed')
      order by h.fame_score desc nulls last, h.issue_count desc nulls last, h.id
      limit result_limit offset result_offset;
    return;
  end if;

  -- ── Real search: single-column indexable trigram filter (search_text GIN) +
  --    fame-primary ranking so a famous prefix/contains beats an obscure
  --    exact-name homonym; exact match wins ties between equally famous heroes.
  --    The post-trigram result set is small, so this sort is cheap.
  return query
    select
      h.id, h.name, h.publisher, h.alignment, h.image_md_url, h.image_url,
      h.portrait_url, h.full_name, h.aliases, h.fame_score::integer
    from public.heroes h
    where
      (h.search_text like '%' || lower(q) || '%' or h.search_text % lower(q))
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
    order by
      (
        case
          when h.name ilike q then 300 + coalesce(h.fame_score, 0) * 20
          when h.name ilike q || '%' then 200 + coalesce(h.fame_score, 0) * 20
          when h.name ilike '%' || q || '%' then 120 + coalesce(h.fame_score, 0) * 20
          when coalesce(h.full_name, '') ilike q
            or coalesce(h.full_name, '') ilike q || '%'
            or public.heroes_aliases_text(h.aliases) ilike q
            or public.heroes_aliases_text(h.aliases) ilike q || '%'
            then 80 + coalesce(h.fame_score, 0) * 20
          else 20 + coalesce(h.fame_score, 0) * 6
        end
      ) desc,
      h.fame_score desc nulls last,
      h.issue_count desc nulls last,
      h.id
    limit result_limit offset result_offset;
end;
$function$;
