-- Search hardening: (1) a single indexable search_text column so the query stops
-- seq-scanning all ~34k rows, and (2) a fame-primary ranking so famous characters
-- beat obscure exact-name homonyms ("spider" -> Spider-Man, not 8 nobodies named
-- "Spider").

-- 1. One searchable text column = name + full_name + aliases, lowercased. The
--    aliases helper is IMMUTABLE, so a STORED generated column stays fresh with
--    no trigger.
alter table public.heroes
  add column if not exists search_text text
  generated always as (
    lower(
      coalesce(name, '') || ' ' ||
      coalesce(full_name, '') || ' ' ||
      coalesce(public.heroes_aliases_text(aliases), '')
    )
  ) stored;

-- 2. A single GIN trigram index powers the whole filter (LIKE + % similarity),
--    replacing the multi-column OR that the planner couldn't index.
create index if not exists heroes_search_text_trgm_idx
  on public.heroes using gin (search_text gin_trgm_ops);

-- 3. Rewrite search_heroes: single-column indexable filter + fame-primary blend.
--    Signature/return shape unchanged, so CREATE OR REPLACE is safe.
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
language sql
stable
set search_path to 'public'
as $function$
  select
    h.id, h.name, h.publisher, h.alignment, h.image_md_url, h.image_url,
    h.portrait_url, h.full_name, h.aliases, h.fame_score
  from public.heroes h
  where
    (
      trim(search_query) = ''
      -- search_text is already lower(), so a lowered LIKE pattern is case-correct
      -- and lets the GIN trigram index serve the predicate (no seq scan).
      or h.search_text like '%' || lower(search_query) || '%'
      or h.search_text % lower(search_query)
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
      -- Fame-primary: match-tier sets a base, fame*20 (range 0..2000) dominates
      -- so a famous prefix/contains beats an obscure exact-name homonym; exact
      -- match still wins ties between similarly-famous characters.
      case
        when h.name ilike search_query then 300 + coalesce(h.fame_score, 0) * 20
        when h.name ilike search_query || '%' then 200 + coalesce(h.fame_score, 0) * 20
        when h.name ilike '%' || search_query || '%' then 120 + coalesce(h.fame_score, 0) * 20
        when coalesce(h.full_name, '') ilike search_query
          or coalesce(h.full_name, '') ilike search_query || '%'
          or public.heroes_aliases_text(h.aliases) ilike search_query
          or public.heroes_aliases_text(h.aliases) ilike search_query || '%'
          then 80 + coalesce(h.fame_score, 0) * 20
        else 20 + coalesce(h.fame_score, 0) * 6
      end
    ) desc,
    h.fame_score desc nulls last,
    h.issue_count desc nulls last,
    h.id
  limit result_limit offset result_offset;
$function$;
