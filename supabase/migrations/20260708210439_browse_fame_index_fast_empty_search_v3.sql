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
$function$;;
