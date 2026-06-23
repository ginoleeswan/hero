# Command Center — Web Observability Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Implement
> task-by-task; commit after each task; run `yarn test:ci` and `yarn tsc --noEmit` before
> committing source changes.

**Date:** 2026-06-23
**Status:** Planned (ready to build)
**Goal:** Fill the two dimmed rail slots in the Mythique Command Center so that — ahead of the
web launch — we can see **who's online**, **who viewed which page / hero**, and **what to
focus on**. Three workstreams, built in order: **Community** → **Presence** → **Traffic**.

**Source specs (already in repo):**
- `docs/superpowers/specs/2026-06-14-command-center-engagement-domain-design.md` (Approved) — Community/engagement domain.
- `docs/superpowers/specs/2026-06-17-command-center-traffic-domain-design.md` (Draft) — Traffic domain. **Decision since spec:** we go with **Approach 2 (self-hosted `page_views`)**, not the Vercel API, so the domain is plan-independent and gives per-user attribution.

**Decisions baked in (confirmed with product owner 2026-06-23):**
1. Build all three; **Community first**.
2. Traffic data is **self-hosted** in a `page_views` table (no Vercel-plan dependency).
3. **Presence** ("who's online") is **new** (not in either spec) and is folded into the
   Community domain rather than its own rail item.

## Global constraints (from CLAUDE.md / repo conventions)

- **yarn** only. Tests: `yarn test:ci`. Typecheck: `yarn tsc --noEmit`.
- Screens **never** import `supabase` directly — all DB access via `src/lib/db/`.
- Migrations: new file `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, applied via
  `mcp__supabase__apply_migration` (not the dashboard). Regenerate
  `src/types/database.generated.ts` via `mcp__supabase__generate_typescript_types` after each.
- New tables auto-enable RLS. **Always add an explicit policy** or the table returns 0 rows /
  RPCs return `[]` silently.
- Cross-user aggregation runs through **admin-guarded `SECURITY DEFINER` RPCs**, mirroring the
  established pattern: guard with
  `exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin)`,
  `set search_path = public`, `revoke all ... from public, anon`, then explicit grants.
- PostgREST caps at 1000 rows — always `.limit()`.
- Styles: `StyleSheet.create`; fonts `Flame-Regular` (display) / `FlameSans-Regular` (body) /
  `Nunito_*` (UI). Domain files reuse `Panel` / `Bento` / `HeroThumb` and stay < ~400 lines.
- Domain UI is **web-only** chrome but the command center already ships `health.tsx` +
  `health.web.tsx`; new domain components live under `src/components/admin/health/domains/`
  and are imported by `health.web.tsx` (the native `health.tsx` is a thin stub — follow
  whatever the existing domains do).

---

# Phase 1 — Community domain (engagement & "who viewed what")

Highest value, zero external dependencies, spec already approved. Reads existing tables
(`user_view_history`, `user_favourites`, `matchup_votes`, `contributions`,
`contributor_stats`, `verdicts`, `user_profiles`) through one admin RPC.

## Task 1.1 — `admin_community_overview()` RPC

**File:** `supabase/migrations/<ts>_admin_community_overview.sql`

Single round trip, admin-guarded, returns one JSON object. Lists capped (8 leaderboard / 12
activity) for one cheap query. Returns empty/zero shape for non-admins (never raises to the
client UI — but revoke from anon).

```sql
-- Read-only community/engagement analytics for the command center.
-- Admin-guarded; aggregates per-user tables that individually carry RLS.
create or replace function public.admin_community_overview()
returns json language plpgsql security definer set search_path = public stable
as $$
declare
  is_admin boolean := exists (
    select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin
  );
begin
  if not is_admin then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'totals', (select json_build_object(
      'members',       (select count(*) from public.user_profiles),
      'favourites',    (select count(*) from public.user_favourites),
      'views',         (select count(*) from public.user_view_history),
      'compares',      (select count(*) from public.verdicts),
      'votes',         (select count(*) from public.matchup_votes),
      'contributions', (select count(*) from public.contributions)
    )),
    'topViewed', (select coalesce(json_agg(r), '[]') from (
      select h.id, h.name, h.image_url, h.publisher, count(*)::int as count
      from public.user_view_history v join public.heroes h on h.id = v.hero_id
      group by h.id order by count(*) desc limit 8
    ) r),
    'topFavourited', (select coalesce(json_agg(r), '[]') from (
      select h.id, h.name, h.image_url, h.publisher, count(*)::int as count
      from public.user_favourites f join public.heroes h on h.id = f.hero_id
      group by h.id order by count(*) desc limit 8
    ) r),
    'topBacked', (select coalesce(json_agg(r), '[]') from (
      select h.id, h.name, h.image_url, h.publisher,
             count(*)::int as count
      from public.matchup_votes mv join public.heroes h on h.id = mv.picked_id
      group by h.id order by count(*) desc limit 8
    ) r),
    'topContributors', (select coalesce(json_agg(r), '[]') from (
      select cs.user_id as "userId", p.display_name as "displayName",
             cs.approved, cs.level
      from public.contributor_stats cs
      left join public.user_profiles p on p.id = cs.user_id
      order by cs.approved desc limit 8
    ) r),
    'contributionsByStatus', (select json_build_object(
      'pending',  count(*) filter (where status = 'pending'),
      'approved', count(*) filter (where status = 'approved'),
      'rejected', count(*) filter (where status = 'rejected')
    ) from public.contributions),
    'recent', (select coalesce(json_agg(r), '[]') from (
      select * from (
        select 'view'::text as kind, v.viewed_at as at, h.id as "heroId", h.name as "heroName", null::text as text
          from public.user_view_history v join public.heroes h on h.id = v.hero_id
        union all
        select 'favourite', f.created_at, h.id, h.name, null
          from public.user_favourites f join public.heroes h on h.id = f.hero_id
        union all
        select 'vote', mv.created_at, h.id, h.name, null
          from public.matchup_votes mv join public.heroes h on h.id = mv.picked_id
        union all
        select 'contribution', c.created_at, h.id, h.name,
               coalesce('edited ' || c.target_field, c.kind)
          from public.contributions c join public.heroes h on h.id = c.hero_id
      ) u order by at desc limit 12
    ) r)
  );
end;
$$;

revoke all on function public.admin_community_overview() from public, anon;
grant execute on function public.admin_community_overview() to authenticated, service_role;
```

> **Note on `topBacked` win-rate:** the spec wants an optional `winRate` per backed hero. A
> hero appears in many matchups; a true win rate needs (times picked) / (times in a matchup as
> either side). Add as a follow-up `select` if cheap; ship count-only first.

- [ ] Write the migration. Confirm column names against the live schema first with
  `mcp__supabase__execute_sql` (`user_favourites`/`verdicts`/`matchup_votes` column names —
  e.g. does `user_favourites` have `created_at`? if not, drop it from `recent`).
- [ ] Apply via `mcp__supabase__apply_migration` (name `admin_community_overview`).
- [ ] Verify: `select public.admin_community_overview();` as an admin → `authorized:true` with
  totals matching the spec's known volumes (~30 views, 82 verdicts, etc.).
- [ ] Regenerate types; commit.

## Task 1.2 — DB wrapper `src/lib/db/community.ts`

```ts
export interface HeroStat { id: string; name: string; image_url: string | null; publisher: string | null; count: number; winRate?: number; }
export interface Contributor { userId: string; displayName: string | null; approved: number; level: string | null; }
export interface ActivityItem { kind: 'favourite' | 'view' | 'compare' | 'vote' | 'contribution'; at: string; heroId: string; heroName: string; text?: string; }
export interface CommunityOverview {
  totals: { members: number; favourites: number; views: number; compares: number; votes: number; contributions: number };
  topViewed: HeroStat[]; topFavourited: HeroStat[]; topBacked: HeroStat[];
  topContributors: Contributor[];
  contributionsByStatus: { pending: number; approved: number; rejected: number };
  recent: ActivityItem[];
}
export async function fetchCommunityOverview(): Promise<CommunityOverview | null>;
```

- [ ] `fetchCommunityOverview` calls `supabase.rpc('admin_community_overview')`; returns `null`
  when `authorized:false` or on error (so the UI shows an empty/locked state, never crashes).

## Task 1.3 — `CommunityDomain.tsx` + wire-up

- [ ] Create `src/components/admin/health/domains/CommunityDomain.tsx` — bento of `Panel`s,
  reusing `HeroThumb`, `relTime`, the existing bar/stat patterns:
  1. Headline stats (Members · Favourites · Views · Compares · Votes · Contributions)
  2. Most-viewed heroes (top 8, deep-link `/character/:id`)
  3. Most-favourited heroes (top 8)
  4. Most-backed heroes (top 8, matchup votes)
  5. Top contributors (name + approved + level chip; header action **"Open review"** →
     switches `domain` to `catalog`/Review sub-tab; badge = `contributionsByStatus.pending`)
  6. Recent activity (unified, icon-coded, `relTime`)
  Each panel has a calm empty state (expected pre-launch).
- [ ] **Rename rail slot** in `src/components/admin/health/format.ts`: `DomainKey` `'users'`
  → `'community'`; `DOMAINS` entry `{ key:'community', label:'Community', icon:'people-outline' }`
  and **remove `placeholder:true`** (it becomes a real domain).
- [ ] Add the query in `src/components/admin/health/hooks.ts` (or domain-local):
  `useCommunity` — React Query, `enabled: gateResolved && isAdmin && domain==='community'`,
  `staleTime: 60_000`.
- [ ] Route it in `app/admin/health.web.tsx`: replace the `domain === 'users'` placeholder
  block with `domain === 'community' && <CommunityDomain data={communityQ.data} ... />`.
- [ ] Update `__tests__/components/admin/health/format.test.ts` domain-key assertions
  (`users` → `community`).
- [ ] `yarn tsc --noEmit && yarn test:ci`; commit.

---

# Phase 2 — Presence ("who's online")

Not covered by either spec. Two layers, because the app is **not** auth-gated (logged-out users
browse freely):

- **Named-user presence** — `user_profiles.last_seen_at`, updated by a throttled heartbeat.
  Tells us *which* signed-in users are online now / active today. **Self-contained — ships in
  this phase.**
- **Anonymous "active now" count** — derived from `page_views` recency (distinct `session_id`
  in the last 5 min). **Depends on Phase 3's `page_views` table**; wire it into the panel once
  Phase 3 lands.

## Task 2.1 — `last_seen_at` + heartbeat RPC

**File:** `supabase/migrations/<ts>_user_presence.sql`

```sql
alter table public.user_profiles add column if not exists last_seen_at timestamptz;
create index if not exists user_profiles_last_seen_idx on public.user_profiles (last_seen_at desc);

-- Throttled heartbeat: stamps the caller's last_seen_at. Cheap; called ~once/min.
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.user_profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated, service_role;
```

- [ ] Apply; regenerate types; commit.

## Task 2.2 — Heartbeat hook + mount

- [ ] `src/hooks/usePresenceHeartbeat.ts` — when `useAuth().user` exists, call
  `supabase.rpc('touch_last_seen')` on mount, on app-focus/visibility regain, and on a ~60s
  interval; no-op for anon. (DB access via a tiny `src/lib/db/presence.ts` wrapper, not direct
  `supabase` in the hook — keep with the repo rule.)
- [ ] Mount it once near `AnalyticsProvider` in `app/_layout.tsx` (it already renders for all
  platforms; the RPC is a no-op when logged out).

## Task 2.3 — Surface presence in Community

- [ ] Extend `admin_community_overview()` (new migration or fold into 1.1 before it ships) with
  an `online` block: `online_now` = `count(*) where last_seen_at > now() - interval '5 min'`,
  `active_today` = `count(*) where last_seen_at > now() - interval '1 day'`, plus a small list
  of the most-recently-seen members (display_name + `last_seen_at`).
- [ ] Add an **"Online now"** panel to `CommunityDomain` (online count + active-today + recent
  members list). Leave a labelled slot for the anonymous "active visitors" number that Phase 3
  fills.

---

# Phase 3 — Traffic domain (self-hosted page views)

Self-hosted `page_views` (Approach 2). Collection reuses the existing `Analytics.web.tsx`,
which already computes `route` (matched pattern, e.g. `/character/[id]`) and `path` (concrete
URL) on every navigation — so route grouping is free and there's almost no new client plumbing.

## Task 3.1 — `page_views` table

**File:** `supabase/migrations/<ts>_page_views.sql`

```sql
-- Self-hosted web page-view events. Privacy: rows are insert-only from clients;
-- NO public select (reads go through admin_traffic_overview only). user_id is set
-- for signed-in views, null for anon; session_id is a random client id.
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  route      text not null,         -- matched pattern e.g. /character/[id]
  path       text not null,         -- concrete url e.g. /character/123
  user_id    uuid references auth.users(id) on delete set null,
  session_id text,                  -- anon client id (random, persisted client-side)
  referrer   text,                  -- document.referrer host, if any
  device     text,                  -- 'desktop' | 'mobile' | 'tablet'
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_route_idx    on public.page_views (route);
create index if not exists page_views_session_idx  on public.page_views (session_id);

alter table public.page_views enable row level security;
-- Anyone (anon or signed-in) may insert their own view; nobody may read directly.
drop policy if exists page_views_insert on public.page_views;
create policy page_views_insert on public.page_views
  for insert to anon, authenticated with check (true);
-- (No select policy → table is unreadable except via the SECURITY DEFINER RPC below.)
```

> **Abuse note:** `with check (true)` lets anyone insert arbitrary rows. Acceptable pre-launch;
> before scaling, consider a rate-limit (e.g. a Postgres trigger capping inserts per session/
> minute) or routing writes through an edge function. Flag in the success criteria.

- [ ] Apply; regenerate types; commit.

## Task 3.2 — Write path

- [ ] `src/lib/db/pageViews.ts` — `recordPageView({ route, path })`: derive `device` from
  `navigator.userAgent`, `referrer` from `document.referrer` host, read/create a persistent
  anon `session_id` in `localStorage`, attach `user_id` if a session exists, fire-and-forget
  insert (swallow errors, like `recordView`).
- [ ] Call it from `src/components/Analytics.web.tsx` in an effect keyed on `path` (it already
  has `route` + `path`). Dedupe rapid repeats. **Web only** — the native `Analytics.tsx`
  returns null, so no native writes.

## Task 3.3 — `admin_traffic_overview(p_days int)` RPC

**File:** `supabase/migrations/<ts>_admin_traffic_overview.sql`. Admin-guarded, mirrors 1.1.

Returns JSON: `totals { pageViews, visitors }` (visitors = distinct
`coalesce(user_id::text, session_id)`), `series [{ day, views, visitors }]` (daily, last
`p_days`), `topPages [{ route, views }]` (top 8, already grouped by route), `topReferrers`,
`devices [{ label, views }]`. Default window 28 days (matches Spend).

- [ ] Write + apply; verify `select public.admin_traffic_overview(28);` as admin.
- [ ] Regenerate types; commit.

## Task 3.4 — `TrafficDomain.tsx` + wire-up

- [ ] `src/lib/db/traffic.ts` — `fetchTrafficOverview(days)` wrapper + `TrafficOverview` type.
- [ ] `src/components/admin/health/domains/TrafficDomain.tsx` — bento: headline (page views ·
  visitors), traffic-over-time trend (reuse the completeness/spend chart treatment), top pages,
  top referrers, devices split. Calm empty state pre-traffic.
- [ ] `format.ts`: `traffic` domain → drop `placeholder:true`.
- [ ] `useTraffic` query (`enabled: ... && domain==='traffic'`, `staleTime: 5min`); route
  `domain === 'traffic'` in `health.web.tsx`.
- [ ] **Back-fill Phase 2's anon presence:** add an `active_now` field to `admin_traffic_overview`
  (or a tiny shared read) = distinct `session_id` in `page_views` over the last 5 min, and feed
  the Community "Online now" panel's anonymous slot.
- [ ] `yarn tsc --noEmit && yarn test:ci`; commit.

---

## Cross-cutting: privacy & pre-launch reality

- The two source specs both stress this is **~2-user, forward-looking scaffolding** — the
  panels will read near-empty until launch. Build for correctness + graceful empty states, not
  for volume.
- `page_views` and `last_seen_at` are **per-user behavioural data**. Keep all reads behind
  admin RPCs (no public select), and make sure the privacy policy (`app/privacy*.tsx`) covers
  first-party analytics before launch — **confirm with product owner**.
- Native (iOS/Android) usage analytics is explicitly **out of scope** (different SDK).

## Suggested sequencing

1. **Phase 1** (Community) — ship first; pure win, no deps.
2. **Phase 2.1–2.2** (presence heartbeat + named-user online panel) — small, self-contained.
3. **Phase 3** (page_views + Traffic domain) — then back-fill the anon "active now" count into
   the Community presence panel (Task 3.4 last checkbox).

## Success criteria

- `community` and `traffic` rail items open populated bentos (or calm empty states); no crashes.
- All cross-user aggregates come from admin-guarded `SECURITY DEFINER` RPCs; non-admins get
  nothing; `page_views` is never directly selectable.
- "Who's online" shows named signed-in users (last_seen) and, post-Phase-3, an anonymous
  active-visitor count.
- Hero rows deep-link to `/character/:id`; thumbnails use `HeroThumb` fallback.
- Page-view collection reuses the existing `Analytics.web.tsx` route grouping (no raw ids as
  distinct pages).
- Fully responsive < 760px; matches the dark-chrome/light-panel command-center system.
- Data layers isolated in `community.ts` / `presence.ts` / `pageViews.ts` / `traffic.ts`;
  each domain file < ~400 lines.
```
