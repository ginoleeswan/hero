-- Snapshot before verify-issue-cast rewrites issue casts. There is no PITR on
-- this project and the verifier deletes links, so the pre-state is kept to diff
-- against or restore from. Safe to drop once the new casts have been reviewed.
create table if not exists public.comic_issue_appearances_pre_verify_20260727 as
  select a.*, now() as snapshot_at from public.comic_issue_appearances a;

alter table public.comic_issue_appearances_pre_verify_20260727 enable row level security;

-- max_fame is what the fame gate reads and is cleared alongside the links, so
-- keep the values it was reading too.
create table if not exists public.comic_issues_maxfame_pre_verify_20260727 as
  select id, max_fame, now() as snapshot_at from public.comic_issues;

alter table public.comic_issues_maxfame_pre_verify_20260727 enable row level security;
