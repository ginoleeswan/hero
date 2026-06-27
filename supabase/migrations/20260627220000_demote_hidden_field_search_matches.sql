-- Search quality: demote weak hidden-field matches.
--
-- Fame-weighted ranking surfaced famous heroes that matched only a hidden field
-- as a SUBSTRING — e.g. "bat" matched "Billy Batson" (Captain Marvel's real name)
-- and the alias "Battling Bowman" (Green Arrow), which then ranked near the top
-- with no visible reason (their NAMES contain no "bat") and looked like noise.
--
-- New tiers keep NAME matches above hidden-field matches, and keep STRONG hidden
-- matches reachable (full_name/alias exact-or-prefix, so "bruce wayne" -> Batman
-- still works) while WEAK substring matches sink (reduced fame) — they only appear
-- when there aren't enough better matches.

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
        when h.name ilike search_query then 4000 + coalesce(h.fame_score, 0)
        when h.name ilike search_query || '%' then 3000 + coalesce(h.fame_score, 0)
        when h.name ilike '%' || search_query || '%' then 2000 + coalesce(h.fame_score, 0)
        when coalesce(h.full_name, '') ilike search_query
          or coalesce(h.full_name, '') ilike search_query || '%'
          or public.heroes_aliases_text(h.aliases) ilike search_query
          or public.heroes_aliases_text(h.aliases) ilike search_query || '%'
          then 1500 + coalesce(h.fame_score, 0)
        else 500 + coalesce(h.fame_score, 0) * 0.3
      end
    ) desc,
    h.issue_count desc nulls last,
    h.id
  limit result_limit offset result_offset;
$function$;
