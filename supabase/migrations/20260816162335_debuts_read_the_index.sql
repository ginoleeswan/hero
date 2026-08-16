-- Point get_debuts_this_month at heroes_debut_month_idx.
--
-- Two changes, both about not touching 47,870 rows to keep 2,705:
--   * the month predicate is now `debut_month_of(first_issue_data) = <month>`,
--     which the expression index answers directly;
--   * the `imageUrl is not null` term is kept verbatim so it still matches the
--     index's partial predicate — dropping it would make the index unusable.
--
-- The debut YEAR also stops casting text to a date. It only ran on surviving
-- rows so it was never the cost, but the regex guard already proves the string
-- is ISO-8601, and reading characters 1-4 needs no DateStyle assumption.
-- Behaviour is unchanged: same rows, same order, same shape.

create or replace function public.get_debuts_this_month(
  p_limit integer default 12,
  p_min_fame integer default 1,
  p_max_chars integer default 6
)
returns table(
  issue_id text, series_name text, issue_number text,
  cover_url text, debut_year integer, characters jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with debutants as (
    select
      h.first_issue_data->>'id' as issue_id,
      h.first_issue_data->>'seriesName' as series_name,
      h.first_issue_data->>'issueNumber' as issue_number,
      h.first_issue_data->>'imageUrl' as cover_url,
      substring(h.first_issue_data->>'coverDate' from 1 for 4)::integer as debut_year,
      h.id, h.name, h.image_url, h.portrait_url, h.avatar_url, h.fame_score,
      row_number() over (
        partition by h.first_issue_data->>'id'
        order by h.fame_score desc nulls last
      ) as crank
    from public.heroes h
    where public.debut_month_of(h.first_issue_data)
            = extract(month from current_date)::smallint
      and (h.first_issue_data->>'imageUrl') is not null
      and coalesce(h.fame_score, 0) >= p_min_fame
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
        jsonb_build_object(
          'id', id, 'name', name, 'image_url', image_url,
          'portrait_url', portrait_url, 'avatar_url', avatar_url
        )
        order by fame_score desc nulls last
      ) filter (where crank <= p_max_chars) as characters
    from debutants
    group by issue_id
  )
  select issue_id, series_name, issue_number, cover_url, debut_year, characters
  from issues
  order by top_fame desc nulls last
  limit p_limit;
$function$;;
