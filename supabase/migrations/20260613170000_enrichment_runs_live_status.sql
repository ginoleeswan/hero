-- Live run status for the ops console: edge fn inserts a 'running' row at start,
-- updates progress as it goes, finalises to 'done' (or 'error' on hard failure).
alter table enrichment_runs add column if not exists status text not null default 'done';
alter table enrichment_runs add column if not exists started_at timestamptz;
update enrichment_runs set started_at = created_at where started_at is null;
