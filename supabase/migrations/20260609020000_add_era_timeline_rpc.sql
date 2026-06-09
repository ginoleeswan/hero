-- Era Timeline: buckets heroes into comic ages by the year parsed from their
-- first_appearance string, returning the top `per_era` (by issue_count) for each.
create or replace function get_era_timeline(per_era int default 7)
returns table (era text, hero_id text, name text, image_url text, portrait_url text, year int)
language sql stable as $$
  with parsed as (
    select h.id, h.name, h.image_url, h.portrait_url, h.issue_count,
      (substring(h.first_appearance from '(19[0-9]{2}|20[0-9]{2})'))::int as yr
    from heroes h
    where h.first_appearance ~ '(19[0-9]{2}|20[0-9]{2})'
      and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed'))
      and (h.image_url is not null or h.portrait_url is not null)
  ),
  e as (
    select *,
      case
        when yr between 1938 and 1955 then 'Golden Age'
        when yr between 1956 and 1969 then 'Silver Age'
        when yr between 1970 and 1984 then 'Bronze Age'
        when yr >= 1985 then 'Modern Age'
      end as era
    from parsed
    where yr between 1938 and extract(year from now())::int
  ),
  ranked as (
    select *, row_number() over (partition by era order by issue_count desc nulls last) as rn
    from e
    where era is not null
  )
  select era, id as hero_id, name, image_url, portrait_url, yr as year
  from ranked
  where rn <= per_era
  order by
    case era when 'Golden Age' then 1 when 'Silver Age' then 2 when 'Bronze Age' then 3 else 4 end,
    issue_count desc nulls last;
$$;
