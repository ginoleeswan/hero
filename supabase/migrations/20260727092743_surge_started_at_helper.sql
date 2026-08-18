create or replace function public.surge_started_at(p_series jsonb)
returns date
language sql
immutable
as $$
  with pts as (
    select (e->>'date')::date as d, (e->>'views')::numeric as v
    from jsonb_array_elements(coalesce(p_series, '[]'::jsonb)) e
    where e ? 'date' and e ? 'views'
  ),
  med as (
    select percentile_cont(0.5) within group (order by v) as m from pts
  ),
  flagged as (
    select d, v,
           (v >= 2 * (select greatest(m, 1) from med)) as hot,
           row_number() over (order by d desc) as from_newest
    from pts
  ),
  run as (
    select min(d) as started
    from flagged
    where hot
      and from_newest <= coalesce(
        (select min(from_newest) from flagged where not hot), 999
      ) - 1
  )
  select started from run;
$$;;
