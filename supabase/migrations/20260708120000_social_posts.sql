-- social_posts: the published social-content queue (images live on Cloudinary).
-- Written by the local publish script (service role); read + posted-state
-- managed from the command-center Social lane (admin-gated RLS).
create table if not exists social_posts (
  id          uuid primary key default gen_random_uuid(),
  batch       text not null,              -- 'launch' | 'week-YYYY-MM-DD'
  ord         int  not null,              -- position within the batch
  day         text,                       -- 'mon'…'sun' for weeks, 'day 1'… for launch
  kind        text not null default 'post', -- brand | matchup | ranking | bio | …
  title       text not null,
  image_url   text not null,              -- Cloudinary URL (first/cover slide)
  slide_urls  text[] not null default '{}', -- all slides for carousels
  caption     text not null default '',
  guide_where text,
  guide_when  text,
  posted_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (batch, ord)
);

alter table social_posts enable row level security;
create policy social_posts_admin_read on social_posts for select
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));
create policy social_posts_admin_update on social_posts for update
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));

create index if not exists social_posts_batch_idx on social_posts (batch, ord);
