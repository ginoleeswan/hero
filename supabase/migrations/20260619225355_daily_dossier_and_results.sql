-- 1) Add the bio fields the client needs to build a redacted "dossier" clue.
create or replace function public.get_daily_hero(p_date date default current_date)
returns json
language sql
stable security definer
set search_path to 'public'
as $function$
  with pool as (
    select
      id, name, full_name, aliases, summary,
      image_url, portrait_url, publisher, alignment, origin, gender,
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
      'id', k.id, 'name', k.name, 'full_name', k.full_name, 'aliases', k.aliases,
      'summary', k.summary, 'image_url', k.image_url, 'portrait_url', k.portrait_url,
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

-- 2) Anonymous per-day results, for a global guess distribution + percentile.
create table if not exists public.daily_game_results (
  id bigint generated always as identity primary key,
  puzzle_date date not null,
  won boolean not null,
  guesses smallint,
  created_at timestamptz not null default now()
);
create index if not exists daily_game_results_date_idx on public.daily_game_results (puzzle_date);
-- RLS on with no policies: the table is reachable only via the definer RPCs below.
alter table public.daily_game_results enable row level security;

create or replace function public.record_daily_result(p_date date, p_won boolean, p_guesses int)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.daily_game_results (puzzle_date, won, guesses)
  values (p_date, p_won, greatest(1, least(coalesce(p_guesses, 1), 10)));
$function$;

create or replace function public.get_daily_distribution(p_date date)
returns json
language sql
stable security definer
set search_path to 'public'
as $function$
  with r as (select won, guesses from public.daily_game_results where puzzle_date = p_date)
  select json_build_object(
    'total', (select count(*) from r),
    'wins', (select count(*) from r where won),
    'losses', (select count(*) from r where not won),
    'dist', coalesce((
      select json_agg(json_build_object('g', g, 'c', c) order by g)
      from (select guesses g, count(*) c from r where won group by guesses) s
    ), '[]'::json)
  );
$function$;

grant execute on function public.record_daily_result(date, boolean, int) to anon, authenticated, service_role;
grant execute on function public.get_daily_distribution(date) to anon, authenticated, service_role;;
