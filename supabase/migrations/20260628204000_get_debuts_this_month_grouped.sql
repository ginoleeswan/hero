-- Redesign: "This Month in History" is now ISSUE-centric, not character-centric.
-- One row per debut ISSUE (dedup — Action Comics #1 was showing once for Superman
-- and again for Lois Lane), carrying the fame-ranked cast of characters who first
-- appeared in it as a jsonb array (for face-chips). Issues are ranked by their top
-- character's fame. Return shape changed, so drop the old 2-arg version first.
drop function if exists public.get_debuts_this_month(integer, integer);

create or replace function public.get_debuts_this_month(
  p_limit integer default 12,
  p_min_fame integer default 30,
  p_max_chars integer default 6
)
returns table (
  issue_id text, series_name text, issue_number text,
  cover_url text, debut_year integer, characters jsonb
)
language sql
stable
as $$
  with debutants as (
    select
      h.first_issue_data->>'id' as issue_id,
      h.first_issue_data->>'seriesName' as series_name,
      h.first_issue_data->>'issueNumber' as issue_number,
      h.first_issue_data->>'imageUrl' as cover_url,
      extract(year from (h.first_issue_data->>'coverDate')::date)::integer as debut_year,
      h.id, h.name, h.image_url, h.portrait_url, h.fame_score,
      row_number() over (
        partition by h.first_issue_data->>'id'
        order by h.fame_score desc nulls last
      ) as crank
    from public.heroes h
    where h.first_issue_data->>'coverDate' ~ '^\d{4}-\d{2}-\d{2}'
      and extract(month from (h.first_issue_data->>'coverDate')::date)
          = extract(month from current_date)
      and coalesce(h.fame_score, 0) >= p_min_fame
      and (h.first_issue_data->>'imageUrl') is not null
      and (h.first_issue_data->>'id') is not null
  ),
  issues as (
    select
      issue_id,
      max(series_name) as series_name,
      max(issue_number) as issue_number,
      max(cover_url) as cover_url,
      max(debut_year) as debut_year,
      max(fame_score) as top_fame,
      jsonb_agg(
        jsonb_build_object('id', id, 'name', name, 'image_url', image_url, 'portrait_url', portrait_url)
        order by fame_score desc nulls last
      ) filter (where crank <= p_max_chars) as characters
    from debutants
    group by issue_id
  )
  select issue_id, series_name, issue_number, cover_url, debut_year, characters
  from issues
  order by top_fame desc nulls last
  limit p_limit;
$$;
grant execute on function public.get_debuts_this_month(integer, integer, integer)
  to anon, authenticated, service_role;
