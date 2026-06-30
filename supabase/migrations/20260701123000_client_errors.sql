-- Self-hosted client error log — the collection side of a command-center
-- "Errors" surface. We self-host (rather than add a third-party crash reporter)
-- to mirror the page_views pattern: zero new vendor, RLS-locked, admin-read-only.
-- Written client-side from the web ErrorBoundary and global window error /
-- unhandledrejection handlers.
--
-- Privacy / safety: insert-only from clients, NO public select policy, so rows
-- are unreadable except through the admin-guarded admin_recent_client_errors()
-- RPC. user_id is set for signed-in sessions (FK set null on account deletion),
-- null for anon; session_id is the same random client id used by page_views.
create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  kind       text not null,          -- 'boundary' | 'error' | 'unhandledrejection'
  message    text not null,          -- truncated client-side
  stack      text,                   -- truncated client-side
  source     text,                   -- url/route where it occurred
  user_agent text,
  user_id    uuid references auth.users(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_kind_idx    on public.client_errors (kind);

alter table public.client_errors enable row level security;

-- Anyone (anon or signed-in) may record an error; nobody may read directly.
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert to anon, authenticated with check (true);
-- (Intentionally no select policy → reads only via admin_recent_client_errors.)

-- ABUSE NOTE: `with check (true)` lets anyone insert arbitrary rows. The client
-- throttles/dedupes; acceptable pre-launch. Before scaling, add a
-- per-session/minute rate limit (trigger) or route writes through an edge fn.

-- Admin-guarded read: headline totals, kind breakdown, top recurring signatures
-- (grouped by message), and the latest raw rows — one round trip for the panel.
create or replace function public.admin_recent_client_errors(p_days int default 7, p_limit int default 50)
returns json language plpgsql security definer set search_path = public stable
as $$
declare
  is_admin boolean := exists (
    select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin
  );
  v_since timestamptz := now() - make_interval(days => greatest(p_days, 1));
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'rangeDays', greatest(p_days, 1),
    'total', (select count(*) from public.client_errors where created_at >= v_since),
    'byKind', (select coalesce(json_object_agg(kind, n), '{}'::json) from (
      select kind, count(*)::int as n from public.client_errors
      where created_at >= v_since group by kind
    ) k),
    -- Top recurring signatures: collapse on message so a single repeated bug
    -- doesn't drown the list.
    'top', (select coalesce(json_agg(t), '[]'::json) from (
      select message,
             count(*)::int as count,
             max(created_at) as last_seen,
             (array_agg(kind order by created_at desc))[1] as kind,
             (array_agg(source order by created_at desc))[1] as source
      from public.client_errors
      where created_at >= v_since
      group by message
      order by count(*) desc, max(created_at) desc
      limit greatest(p_limit, 1)
    ) t),
    -- Latest raw rows for drill-down.
    'recent', (select coalesce(json_agg(r), '[]'::json) from (
      select id, kind, message, source, stack, created_at
      from public.client_errors
      where created_at >= v_since
      order by created_at desc
      limit greatest(p_limit, 1)
    ) r)
  );
end;
$$;
