create or replace function public.get_daily_hero(p_date date default current_date)
returns json
language sql stable security definer set search_path = public
as $$
  with pool as (
    select
      id, name, image_url, portrait_url, publisher, alignment, origin, gender,
      first_appearance, coalesce(powerstats_total, 0) as powerstats_total,
      coalesce(powers, '{}') as powers
    from public.heroes
    where image_url is not null
      and summary is not null
      and alignment is not null
      and coalesce(powerstats_total, 0) > 0
      and issue_count is not null
    order by issue_count desc
    limit 500
  ),
  ordered as (
    select *, row_number() over (order by md5(id || 'mythique-daily-v1')) - 1 as idx
    from pool
  ),
  n as (select count(*)::int as c from ordered),
  pick as (
    select ordered.* from ordered, n
    where n.c > 0 and ordered.idx = (p_date - date '2024-01-01') % n.c
  )
  select json_build_object(
    'number', (p_date - date '2024-01-01') + 1,
    'date', p_date,
    'hero', json_build_object(
      'id', id, 'name', name, 'image_url', image_url, 'portrait_url', portrait_url,
      'publisher', publisher, 'alignment', alignment, 'origin', origin, 'gender', gender,
      'first_appearance', first_appearance, 'powerstats_total', powerstats_total, 'powers', powers
    )
  )
  from pick;
$$;
revoke all on function public.get_daily_hero(date) from public;
grant execute on function public.get_daily_hero(date) to anon, authenticated, service_role;;
