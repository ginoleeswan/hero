-- Extend get_daily_hero to also return a fixed set of tappable guess options
-- (the answer + 5 plausible decoys) so the daily game is multiple-choice rather
-- than free-text. Decoys prefer the answer's publisher, then a date-seeded
-- shuffle; the combined options are shuffled by date so the answer's slot isn't
-- predictable. Answer-selection logic is unchanged.
create or replace function public.get_daily_hero(p_date date default current_date)
returns json
language sql
stable security definer
set search_path to 'public'
as $function$
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
  ),
  -- Plausible wrong answers: same publisher first, then a date-seeded shuffle.
  decoys as (
    select p.id, p.name
    from pool p, pick k
    where p.id <> k.id
    order by (p.publisher is distinct from k.publisher),
             md5(p.id || p_date::text || 'mythique-decoy-v1')
    limit 5
  ),
  options as (
    select id, name from pick
    union all
    select id, name from decoys
  )
  select json_build_object(
    'number', (p_date - date '2024-01-01') + 1,
    'date', p_date,
    'hero', (select json_build_object(
      'id', k.id, 'name', k.name, 'image_url', k.image_url, 'portrait_url', k.portrait_url,
      'publisher', k.publisher, 'alignment', k.alignment, 'origin', k.origin, 'gender', k.gender,
      'first_appearance', k.first_appearance, 'powerstats_total', k.powerstats_total, 'powers', k.powers
    ) from pick k),
    'options', (
      select coalesce(
        json_agg(json_build_object('id', o.id, 'name', o.name)
          order by md5(o.id || p_date::text || 'mythique-opts-v1')),
        '[]'::json)
      from options o
    )
  );
$function$;

grant execute on function public.get_daily_hero(date) to anon, authenticated, service_role;
