-- Alignment split + powerstats-total histogram for the dashboard charts.
create or replace function catalog_distributions()
returns jsonb language sql stable security invoker as $$
  with base as (select * from heroes where enriched_at is not null)
  select jsonb_build_object(
    'alignment', jsonb_build_object(
      'good',    (select count(*) from base where alignment = 'good'),
      'bad',     (select count(*) from base where alignment = 'bad'),
      'neutral', (select count(*) from base where alignment = 'neutral'),
      'unknown', (select count(*) from base where alignment is null
                    or alignment not in ('good','bad','neutral'))
    ),
    'power_hist', (
      select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'n', cnt) order by bkt), '[]'::jsonb)
      from (
        select bkt,
               count(*) as cnt,
               (bkt*100)::text || (case when bkt = 5 then '+' else '–' || ((bkt+1)*100)::text end) as lbl
        from (select least(5, floor(coalesce(powerstats_total, 0) / 100.0))::int as bkt from base) s
        group by bkt
      ) t
    )
  );
$$;
