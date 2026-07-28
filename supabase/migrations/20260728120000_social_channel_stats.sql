-- Daily account-level channel stats, imported from platform CSV exports
-- (TikTok Studio › Analytics › Overview › Download data). One row per
-- (platform, day); re-imports upsert in place so overlapping exports refresh.
create table social_channel_stats (
  platform      text not null check (platform in ('tiktok', 'instagram', 'x', 'linkedin', 'reddit', 'other')),
  day           date not null,
  views         integer,
  profile_views integer,
  likes         integer,
  comments      integer,
  shares        integer,
  imported_at   timestamptz not null default now(),
  primary key (platform, day)
);

alter table social_channel_stats enable row level security;
create policy social_channel_stats_admin_read on social_channel_stats for select
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));
create policy social_channel_stats_admin_insert on social_channel_stats for insert
  with check (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));
create policy social_channel_stats_admin_update on social_channel_stats for update
  using (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin))
  with check (exists (select 1 from user_profiles p where p.id = (select auth.uid()) and p.is_admin));

-- Per-post shares — TikTok's per-post CSV export reports them; the existing
-- snapshot columns predate a platform that did.
alter table social_post_results add column shares integer;
