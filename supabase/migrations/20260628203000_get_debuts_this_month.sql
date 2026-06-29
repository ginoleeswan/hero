-- "This Month in History" reader: recognizable characters who debuted in the
-- current calendar month, with their debut cover. Reads the existing
-- heroes.first_issue_data JSONB (coverDate is camelCase, YYYY-MM-DD; American
-- comics are month-precision so we match by MONTH, not exact day). current_date
-- is evaluated per call, so the result rolls over on the 1st — no scheduled job.
create or replace function public.get_debuts_this_month(
  p_limit integer default 14,
  p_min_fame integer default 30
)
returns table (
  id text, name text, image_url text, portrait_url text,
  debut_cover_url text, debut_year integer, fame_score smallint
)
language sql
stable
as $$
  select
    h.id, h.name, h.image_url, h.portrait_url,
    h.first_issue_data->>'imageUrl' as debut_cover_url,
    extract(year from (h.first_issue_data->>'coverDate')::date)::integer as debut_year,
    h.fame_score
  from public.heroes h
  where h.first_issue_data->>'coverDate' ~ '^\d{4}-\d{2}-\d{2}'
    and extract(month from (h.first_issue_data->>'coverDate')::date)
        = extract(month from current_date)
    and coalesce(h.fame_score, 0) >= p_min_fame
    and (h.first_issue_data->>'imageUrl') is not null
  order by h.fame_score desc nulls last
  limit p_limit;
$$;
grant execute on function public.get_debuts_this_month(integer, integer)
  to anon, authenticated, service_role;
