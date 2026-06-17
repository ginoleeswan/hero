# Command Center — Traffic Domain Design

**Date:** 2026-06-17
**Status:** Draft (design phase)
**Scope:** Fill the dimmed "Traffic" rail slot in the Mythique Command Center with web
traffic analytics sourced from **Vercel Web Analytics**.

## Priority note (read first)

Same pre-launch caveat as the Community domain: with ~2 users there is little traffic to
chart. This is **forward-looking scaffolding**. There is an additional gating reality
specific to Traffic — see "Data source constraint" — so this domain may be **blocked on a
plan/API decision** before it can show anything real. Catalog/Build work stays the priority.

## Goal

Replace `PlaceholderDomain` for the command-center's `traffic` rail slot with a **Traffic**
domain: a dense bento of panels showing web page-view/visitor traffic — totals, trend, top
pages, top referrers, device/country split — for the deployed web app.

## What we already have

- **`@vercel/analytics` is wired client-side** (`src/components/Analytics.web.tsx`):
  `<Analytics route path />`, passing both the concrete path and the matched route so Vercel
  **groups dynamic routes** (e.g. `/character/[id]`) instead of logging every id (PR #29).
  This means the *collection* side is done and route grouping is sane.
- The web build deploys to **Vercel**; native builds skip the plugin (see `app.config.ts`).
- An established **admin edge-function proxy pattern**: `gemini-spend` calls an external
  billing API server-side and returns a typed JSON summary; `comicvine-ping` returns a small
  status. Traffic will follow this exact pattern.

## Data source constraint (the key decision)

Vercel Web Analytics **collects** page views but reading them back programmatically is
**plan- and API-gated**:

- The Vercel Web Analytics REST API requires a **Vercel API token** + **team/project id**,
  and historically is limited to **Pro/Enterprise** plans. Availability/shape must be
  confirmed against the current Vercel account before committing.
- A token must never reach the client → all reads go through a **Supabase edge function**
  (`vercel-analytics`) holding `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID`
  in its env, returning a typed summary. Mirrors `gemini-spend` exactly.

### Approaches

1. **Vercel Web Analytics API via edge function (recommended if the plan supports it).**
   Zero new tracking; reuses the data Vercel already collects with proper route grouping.
   *Risk:* plan-gated; if the account is Hobby/Free the API may be unavailable → the domain
   shows a graceful "not available" state (exactly like `gemini-spend` when the BigQuery
   export is off).
2. **Self-hosted pageview events (fallback).** The `Analytics` component (or a tiny hook)
   also writes `{ route, path, ts, ref }` to a new `page_views` Supabase table; the domain
   aggregates that via an admin RPC. *Pros:* no plan dependency, full control. *Cons:*
   duplicates Vercel, adds write volume + an RLS/abuse surface, and needs route grouping
   re-implemented server-side.
3. **Defer entirely.** Keep the placeholder until the account is on a plan with the API.

**Recommendation:** spec for **Approach 1** with the `gemini-spend`-style "unavailable"
fallback baked in, so it ships safely regardless of plan and upgrades automatically when the
API is enabled. Treat Approach 2 as a separate future spec only if self-hosting is wanted.

## Architecture (mirrors gemini-spend)

```
supabase/functions/vercel-analytics/index.ts   edge fn: calls Vercel Analytics API, returns typed summary or { available:false, reason }
src/lib/db/traffic.ts                           supabase.functions.invoke('vercel-analytics') wrapper + TrafficOverview type
src/components/admin/health/domains/TrafficDomain.tsx   bento of Panels (reuses Panel/Bento)
src/components/admin/health/hooks.ts            useTraffic query, gated on isAdmin, staleTime ~5min
app/admin/health.web.tsx                        route domain === 'traffic' → TrafficDomain
```

No Supabase schema changes for Approach 1 (data lives in Vercel). The only secrets are the
edge-function env vars above.

### Edge-function return shape

```ts
interface TrafficOverview {
  available: boolean;
  reason?: string;             // when unavailable (plan/token), shown in the empty state
  range?: string;              // e.g. "last 28 days"
  totals?: { pageViews: number; visitors: number };
  series?: { day: string; views: number; visitors: number }[];  // daily trend
  topPages?: { route: string; views: number }[];   // grouped routes (top 8)
  topReferrers?: { source: string; views: number }[]; // top 8
  devices?: { label: string; views: number }[];     // desktop/mobile/tablet
  countries?: { code: string; views: number }[];    // top 8
}
```

## UI — TrafficDomain panels (bento)

Reuses `Panel`, `Bento`/`Bento.Row`, the existing sparkline/bar patterns from `CommandHome`/
`SpendDomain`. One column < 760px.

1. **Headline stats** — Page views · Visitors (range caption).
2. **Traffic over time** — daily area/line trend (same chart treatment as completeness/spend).
3. **Top pages** — route + views bar list (uses the grouped routes from #29).
4. **Top referrers** — source + views bar list.
5. **Devices / Countries** — two small split panels (bar lists).

When `available:false` (plan/token missing), the whole domain renders one calm panel:
"Vercel Web Analytics isn't connected — add `VERCEL_API_TOKEN` and a Pro plan" (mirrors the
`SpendDomain` unavailable state).

## Data flow

`useTraffic` (React Query, `enabled: gateResolved && isAdmin`, `staleTime: 5min`) sits with
the other queries; its data is passed into `TrafficDomain` as props like every other domain.
No new global state.

## Out of scope (YAGNI)

- Real-time / live visitor counts.
- Per-visitor sessions or funnels (Web Analytics is aggregate + privacy-friendly by design).
- Self-hosted event pipeline (Approach 2) unless explicitly chosen later.
- Search-query analytics (belongs with the in-app `?q=` search work, not web traffic).
- Native (iOS/Android) usage analytics — different SDK, separate concern.

## Open questions (confirm before planning)

1. **Plan/API:** Is the Vercel account on a plan whose Web Analytics API is accessible, and
   can a scoped read token + project/team id be provisioned? If no → ship the placeholder /
   unavailable state, or pick Approach 2.
2. **Range:** default window (28 days, like spend) acceptable?

## Success criteria

- The `traffic` rail item opens a populated bento when the Vercel API is reachable, or a
  single graceful "not connected" panel when it isn't (never a crash/blank).
- The Vercel token never reaches the client; all reads via the `vercel-analytics` edge fn.
- Top-pages list shows grouped routes (not raw ids), consistent with PR #29.
- Fully responsive < 760px; matches the dark-chrome/light-panel system.
- Data layer isolated in `traffic.ts`; domain file under ~400 lines.
