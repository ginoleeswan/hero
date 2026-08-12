-- Native push tokens, the device counterpart to push_subscriptions.
--
-- Web Push and Expo Push are different transports with different identifiers,
-- and merging them into one table would mean a nullable column per transport
-- plus a discriminator that every query has to remember. Two narrow tables, one
-- sender that reads both, is the cheaper shape.
--
-- Keyed by the token, not by the user: one person can hold several devices, and
-- the same device can be handed between accounts. The token is what the push
-- service addresses, so it is what must be unique.

create table if not exists public.device_push_tokens (
  -- The Expo push token, e.g. ExponentPushToken[xxxxxxxx]. Unique because it
  -- addresses a device install; re-registering must update, never duplicate.
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  -- Delivery hygiene, mirroring push_subscriptions: a good send stamps ok, a
  -- soft failure stamps failed and is retried tomorrow, and a DeviceNotRegistered
  -- deletes the row outright.
  last_ok_at  timestamptz,
  failed_at   timestamptz
);

create index if not exists device_push_tokens_user_idx on public.device_push_tokens(user_id);

alter table public.device_push_tokens enable row level security;

-- Owner-scoped, exactly like push_subscriptions: the client registers its own
-- token with no edge function in the path, and the RLS policy IS the
-- authorization story. The cron sender reads with the service-role key, which
-- bypasses RLS.
create policy device_push_tokens_owner_select on public.device_push_tokens
  for select using (auth.uid() = user_id);

create policy device_push_tokens_owner_insert on public.device_push_tokens
  for insert with check (auth.uid() = user_id);

-- Re-registration is an upsert, so the owner must be able to take over a row
-- that already carries their id — and only theirs.
create policy device_push_tokens_owner_update on public.device_push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy device_push_tokens_owner_delete on public.device_push_tokens
  for delete using (auth.uid() = user_id);

comment on table public.device_push_tokens is
  'Expo push tokens per device install. Owner-scoped RLS; read by send-daily-push with the service-role key. See docs/features/notifications-and-push.md.';
