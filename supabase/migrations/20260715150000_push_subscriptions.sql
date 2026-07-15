-- Web Push subscriptions for the daily-debate re-engagement notification.
-- Owner-scoped (RLS, same pattern as user_favourites): each user manages their
-- own rows; the cron sender reads all of them via the service-role key (bypasses
-- RLS). Signed-in only in v1 — the toggle lives in the auth-gated settings screen.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,   -- stamped by the sender on a successful push
  failed_at   timestamptz    -- stamped on a transient failure; 404/410 rows are DELETED
);

alter table public.push_subscriptions enable row level security;

create policy "push_select" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push_insert" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push_update" on public.push_subscriptions
  for update to authenticated using (auth.uid() = user_id);
create policy "push_delete" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
