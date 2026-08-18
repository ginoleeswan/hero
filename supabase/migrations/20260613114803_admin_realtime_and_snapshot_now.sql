
-- Realtime for live run updates (instant, not just polling).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enrichment_runs'
  ) then
    alter publication supabase_realtime add table enrichment_runs;
  end if;
end $$;

-- Manual coverage snapshot (seeds the completeness chart on demand).
create or replace function admin_snapshot_now()
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  perform snapshot_catalog_health();
end $$;
;
