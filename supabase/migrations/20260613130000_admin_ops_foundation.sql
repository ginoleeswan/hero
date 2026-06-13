-- Admin ops foundation: monitoring (enrichment_runs), rate-limit/spend (api_usage),
-- and coverage history (catalog_health_snapshots). All admin-read via RLS; writes
-- happen through service-role edge functions / security-definer RPCs.

create table if not exists enrichment_runs (
  id            bigint generated always as identity primary key,
  run_type      text not null,
  triggered_by  text not null default 'cron',
  processed     int  not null default 0,
  done          int  not null default 0,
  failed        int  not null default 0,
  retry         int  not null default 0,
  remaining     int,
  duration_ms   int,
  created_at    timestamptz not null default now()
);
alter table enrichment_runs enable row level security;
create policy enrichment_runs_admin_read on enrichment_runs for select
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));
create index if not exists enrichment_runs_created_idx on enrichment_runs (created_at desc);

create table if not exists api_usage (
  id          bigint generated always as identity primary key,
  api         text not null,
  endpoint    text,
  units       int  not null default 1,
  created_at  timestamptz not null default now()
);
alter table api_usage enable row level security;
create policy api_usage_admin_read on api_usage for select
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));
create index if not exists api_usage_api_created_idx on api_usage (api, created_at desc);

create table if not exists catalog_health_snapshots (
  id           bigint generated always as identity primary key,
  captured_at  timestamptz not null default now(),
  total        int not null,
  portrait     int not null,
  image        int not null,
  stats        int not null,
  summary      int not null,
  first_issue  int not null
);
alter table catalog_health_snapshots enable row level security;
create policy snapshots_admin_read on catalog_health_snapshots for select
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));

create or replace function snapshot_catalog_health()
returns void language sql security definer as $$
  insert into catalog_health_snapshots (total, portrait, image, stats, summary, first_issue)
  select count(*),
         count(*) filter (where portrait_url is not null),
         count(*) filter (where image_url is not null),
         count(*) filter (where intelligence is not null),
         count(*) filter (where summary is not null),
         count(*) filter (where first_issue_id is not null)
  from heroes where enriched_at is not null;
$$;

create or replace function admin_cron_status()
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'jobname', j.jobname, 'schedule', j.schedule, 'active', j.active,
      'last_run', d.start_time, 'last_status', d.status
    ) order by j.jobname), '[]'::jsonb)
    from cron.job j
    left join lateral (
      select start_time, status from cron.job_run_details d
      where d.jobid = j.jobid order by start_time desc limit 1
    ) d on true
  );
end $$;
