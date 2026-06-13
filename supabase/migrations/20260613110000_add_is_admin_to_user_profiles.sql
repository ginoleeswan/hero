-- Admin flag for gating the in-app catalog-health dashboard. Read via the
-- existing self-select RLS policy (auth.uid() = id), so the client can check its
-- own admin status.
alter table user_profiles add column if not exists is_admin boolean not null default false;

-- Grant admin to the owner's primary account.
update user_profiles set is_admin = true
where id = '331926c9-c217-414c-8de0-850fb40fe7e9';
