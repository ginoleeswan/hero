-- Credentials for platform auto-pull (Instagram now, TikTok later). A DB row
-- (not a static secret) so the edge function can rewrite the token in place
-- on refresh — Instagram long-lived tokens need refreshing every ~60 days.
create table platform_credentials (
  platform     text primary key,
  access_token text not null,
  external_id  text, -- e.g. Instagram user id
  expires_at   timestamptz,
  updated_at   timestamptz not null default now()
);

alter table platform_credentials enable row level security;
create policy platform_credentials_admin_all on platform_credentials for all
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin));
-- No anon/authenticated-read policy at all: only admins (via the check above)
-- and the service-role key (edge function) can touch this table.
