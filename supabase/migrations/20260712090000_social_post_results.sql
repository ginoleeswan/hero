-- Per-post performance logging — closes the post → measure → rebias loop.
-- One row per (post, platform) snapshot; numbers grow over time, so multiple
-- snapshots are allowed and the latest recorded_at per platform wins.
create table social_post_results (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references social_posts(id) on delete cascade,
  platform    text not null check (platform in ('tiktok', 'instagram', 'x', 'linkedin', 'reddit', 'other')),
  views       integer,
  likes       integer,
  comments    integer,
  note        text,
  -- the live post URL — the hook for future auto-pull (reddit .json, IG Graph,
  -- TikTok Display API); 'manual' vs 'auto' marks who wrote the snapshot
  post_url    text,
  source      text not null default 'manual' check (source in ('manual', 'auto')),
  recorded_at timestamptz not null default now()
);

alter table social_post_results enable row level security;
create policy social_post_results_admin_read on social_post_results for select
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));
create policy social_post_results_admin_insert on social_post_results for insert
  with check (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));
create policy social_post_results_admin_update on social_post_results for update
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));

create index social_post_results_post_idx on social_post_results (post_id, recorded_at desc);
