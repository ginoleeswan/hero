-- Close popularity-ordering gaps: switch user-facing read-side RPCs from
-- issue_count to fame_score (the catalogue's popularity heuristic). Bodies are
-- otherwise unchanged from their live definitions.

-- Daily puzzle: pick from the most-recognizable well-formed heroes (drop the old
-- issue_count gate; the quality gates below already keep the pool clean).
CREATE OR REPLACE FUNCTION public.get_daily_hero(p_date date DEFAULT CURRENT_DATE)
 RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    order by fame_score desc nulls last
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

-- Era timeline: top heroes per era by fame.
CREATE OR REPLACE FUNCTION public.get_era_timeline(per_era integer DEFAULT 7)
 RETURNS TABLE(era text, hero_id text, name text, image_url text, portrait_url text, year integer)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  with parsed as (
    select h.id, h.name, h.image_url, h.portrait_url, h.fame_score,
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
    select *, row_number() over (partition by era order by fame_score desc nulls last) as rn
    from e
    where era is not null
  )
  select era, id as hero_id, name, image_url, portrait_url, yr as year
  from ranked
  where rn <= per_era
  order by
    case era when 'Golden Age' then 1 when 'Silver Age' then 2 when 'Bronze Age' then 3 else 4 end,
    fame_score desc nulls last;
$function$;

-- Family opponents: order by fame.
CREATE OR REPLACE FUNCTION public.get_family_opponents(p_hero_id text, p_limit integer DEFAULT 24)
 RETURNS TABLE(id text, name text, image_url text, image_md_url text, portrait_url text, publisher text, alignment text)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  select id, name, image_url, image_md_url, portrait_url, publisher, alignment
  from (
    select distinct on (m.id)
      m.id, m.name, m.image_url, m.image_md_url, m.portrait_url,
      m.publisher, m.alignment, m.fame_score
    from public.hero_relatives hr
    join public.heroes m on m.id = hr.related_hero_id and m.id <> p_hero_id
    where hr.hero_id = p_hero_id and hr.related_hero_id is not null
    order by m.id
  ) x
  order by x.fame_score desc nulls last
  limit p_limit;
$function$;

-- Most feared: feared-count primary, fame tiebreak.
CREATE OR REPLACE FUNCTION public.get_most_feared(p_limit integer DEFAULT 12)
 RETURNS TABLE(id text, name text, image_url text, image_md_url text, portrait_url text, publisher text, alignment text, feared_by integer)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  select m.id, m.name, m.image_url, m.image_md_url, m.portrait_url,
         m.publisher, m.alignment, count(distinct r.hero_id)::integer as feared_by
  from public.hero_relationships r
  join public.heroes m on m.id = r.related_id
  where r.kind = 'enemy' and m.alignment in ('bad', 'neutral')
  group by m.id, m.name, m.image_url, m.image_md_url, m.portrait_url, m.publisher, m.alignment
  order by count(distinct r.hero_id) desc, m.fame_score desc nulls last
  limit p_limit;
$function$;

-- Top rivalries: rank pairs by combined fame.
CREATE OR REPLACE FUNCTION public.get_top_rivalries(p_limit integer DEFAULT 12)
 RETURNS TABLE(a_id text, a_name text, a_image_url text, a_portrait_url text, a_publisher text, b_id text, b_name text, b_image_url text, b_portrait_url text, b_publisher text, cross_universe boolean)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  with pairs as (
    select distinct
      least(hero_id, related_id) as x,
      greatest(hero_id, related_id) as y,
      bool_or(cross_universe) as cross_universe
    from public.hero_relationships
    where kind = 'enemy' and source = 'curated'
    group by least(hero_id, related_id), greatest(hero_id, related_id)
  )
  select
    a.id, a.name, a.image_url, a.portrait_url, a.publisher,
    b.id, b.name, b.image_url, b.portrait_url, b.publisher,
    p.cross_universe
  from pairs p
  join public.heroes a on a.id = p.x
  join public.heroes b on b.id = p.y
  order by coalesce(a.fame_score, 0) + coalesce(b.fame_score, 0) desc
  limit p_limit;
$function$;
