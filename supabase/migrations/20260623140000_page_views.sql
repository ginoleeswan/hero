-- Self-hosted web page-view events — the collection side of the command-center
-- "Traffic" domain (we self-host rather than depend on the plan-gated Vercel
-- Analytics read API). Written client-side from Analytics.web.tsx, which already
-- computes the matched `route` (e.g. /character/[id]) and concrete `path`, so
-- dynamic routes stay grouped.
--
-- Privacy: rows are insert-only from clients; there is NO public select policy,
-- so the table is unreadable except through the admin-guarded
-- admin_traffic_overview() RPC. user_id is set for signed-in views (FK set null
-- if the account is later deleted), null for anon; session_id is a random,
-- client-persisted id used to count unique visitors without identifying anyone.
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  route      text not null,          -- matched pattern, e.g. /character/[id]
  path       text not null,          -- concrete url, e.g. /character/123
  user_id    uuid references auth.users(id) on delete set null,
  session_id text,                   -- anon client id (random, persisted client-side)
  referrer   text,                   -- referring host, when cross-origin
  device     text,                   -- 'desktop' | 'mobile' | 'tablet'
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_route_idx    on public.page_views (route);
create index if not exists page_views_session_idx  on public.page_views (session_id);

alter table public.page_views enable row level security;

-- Anyone (anon or signed-in) may record their own view; nobody may read directly.
drop policy if exists page_views_insert on public.page_views;
create policy page_views_insert on public.page_views
  for insert to anon, authenticated with check (true);
-- (Intentionally no select policy → reads only via admin_traffic_overview.)

-- ABUSE NOTE: `with check (true)` lets anyone insert arbitrary rows. Acceptable
-- pre-launch; before scaling, add a per-session/minute rate limit (trigger) or
-- route writes through an edge function.
