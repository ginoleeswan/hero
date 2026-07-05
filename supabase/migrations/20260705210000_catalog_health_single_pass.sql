-- Speed up catalog_health(): the old body did `with base as (select * from heroes …)`,
-- materializing every wide text column (summary, descriptions, …) for ~34k rows into a
-- temp CTE that SPILLED TO DISK, then re-scanned it 7× for the counts — ~5.2s, and it
-- single-handedly gated the whole command-center content area (health.web.tsx renders
-- `{h && domain === …}`, so nothing paints until this resolves).
--
-- Rewrite as a single narrow pass: the base CTE projects only the six boolean flags it
-- needs plus publisher (no wide columns → no disk spill), and metrics + byPublisher both
-- read that. cvStatus stays one group-by over all heroes. Output JSONB shape is byte-for-
-- byte identical, so no client/type changes. Measured 5,235ms → ~270ms (19×).
create or replace function public.catalog_health()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with base as (
    select
      coalesce(publisher, '(none)')  as publisher,
      (portrait_url is not null)     as has_portrait,
      (image_url is not null)        as has_image,
      (intelligence is not null)     as has_stats,
      (summary is not null)          as has_summary,
      (first_issue_id is not null)   as has_fi
    from heroes
    where enriched_at is not null
  ),
  agg as (
    select
      count(*)                             as total,
      count(*) filter (where has_portrait) as portrait,
      count(*) filter (where has_image)    as image,
      count(*) filter (where has_stats)    as stats,
      count(*) filter (where has_summary)  as summary,
      count(*) filter (where has_fi)       as first_issue
    from base
  ),
  by_pub as (
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data
    from (
      select
        publisher,
        count(*)                             as total,
        count(*) filter (where has_portrait) as portrait,
        count(*) filter (where has_stats)    as stats,
        count(*) filter (where has_summary)  as summary
      from base
      group by publisher
      order by count(*) desc
      limit 30
    ) t
  ),
  cv as (
    select coalesce(jsonb_object_agg(coalesce(comicvine_status, 'none'), c), '{}'::jsonb) as data
    from (
      select comicvine_status, count(*) c
      from heroes
      group by comicvine_status
    ) s
  )
  select jsonb_build_object(
    'total', (select total from agg),
    'metrics', jsonb_build_object(
      'portrait',   (select portrait from agg),
      'image',      (select image from agg),
      'stats',      (select stats from agg),
      'summary',    (select summary from agg),
      'firstIssue', (select first_issue from agg)
    ),
    'cvStatus', (select data from cv),
    'byPublisher', (select data from by_pub)
  );
$function$;
