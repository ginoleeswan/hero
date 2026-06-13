-- Daily coverage snapshot at 00:05 UTC for the completeness-over-time history.
select cron.unschedule('catalog-health-snapshot')
  where exists (select 1 from cron.job where jobname = 'catalog-health-snapshot');
select cron.schedule('catalog-health-snapshot', '5 0 * * *', $$ select snapshot_catalog_health(); $$);
