-- Aggregate catalog-coverage stats for the admin health screen, in one round
-- trip. SECURITY INVOKER honours the public-read RLS on heroes; the screen is
-- admin-gated client-side.
create or replace function catalog_health()
returns jsonb
language sql
stable
security invoker
as $$
  with base as (select * from heroes where enriched_at is not null)
  select jsonb_build_object(
    'total', (select count(*) from base),
    'metrics', jsonb_build_object(
      'portrait',   (select count(*) from base where portrait_url is not null),
      'image',      (select count(*) from base where image_url is not null),
      'stats',      (select count(*) from base where intelligence is not null),
      'summary',    (select count(*) from base where summary is not null),
      'firstIssue', (select count(*) from base where first_issue_id is not null)
    ),
    'cvStatus', (
      select jsonb_object_agg(coalesce(comicvine_status, 'none'), c)
      from (select comicvine_status, count(*) c from heroes group by comicvine_status) s
    ),
    'byPublisher', (
      select jsonb_agg(row_to_json(t))
      from (
        select coalesce(publisher, '(none)') as publisher,
               count(*)                                          as total,
               count(*) filter (where portrait_url is not null)  as portrait,
               count(*) filter (where intelligence is not null)  as stats,
               count(*) filter (where summary is not null)       as summary
        from base
        group by publisher
        order by count(*) desc
        limit 30
      ) t
    )
  );
$$;
