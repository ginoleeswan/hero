# Command Center — Engagement Domain Design

**Date:** 2026-06-14
**Status:** Approved (design phase)
**Scope:** Fill the dimmed "Users" rail slot in the Mythique Command Center with a real
**Engagement** domain — content/engagement analytics drawn from existing user-activity
tables.

## Priority note (read first)

The app is effectively **pre-launch**: ~2 auth users, 1 profile, 4 favourites, 31 view
records, 79 verdicts. An engagement dashboard analyses very little until there is a real
user base. This spec is captured as **forward-looking scaffolding**; building it is **not**
the highest-leverage work today (that is catalog enrichment — the 711 backlog, 1,032
missing summaries, 844 missing portraits). Build this when there is behaviour worth
reading.

## Goal

Replace `PlaceholderDomain` for the command-center's `users` rail slot with an
**Engagement** domain: a dense bento of panels showing what users do with the catalogue —
most-viewed / most-favourited / most-compared heroes, headline totals, and a recent
activity feed. The domain complements catalog ops: popularity signals inform what to
prioritise for enrichment.

## Decisions (settled during brainstorming)

1. **Focus:** engagement & content signals (not membership/growth — too sparse).
2. **Rail rename:** `users` → `engagement` ("Users" implied account management, which is
   deferred). Traffic stays a placeholder.
3. **Verdicts:** surface *most-compared heroes* + *recent verdict text*; **no** win/loss
   leaderboard (the `verdict` column is free-text prose, e.g. "Iron Man takes it — 4 of 6
   stats."; parsing a winner is fragile). Revisit if a structured `winner_id` is added.
4. **Vercel Analytics** (web page views) is **out of scope** here — it belongs to the
   future Traffic domain (reachable via Vercel's API, not Supabase).

## Data sources (existing tables)

| Table | Columns used | Signal |
|-------|--------------|--------|
| `user_profiles` | `id, is_admin, created_at` | member / admin counts |
| `auth.users` | `count` only | total members |
| `user_favourites` | `hero_id, created_at` | favourites total, most-favourited, recent |
| `user_view_history` | `hero_id, viewed_at` | views total, most-viewed, recent |
| `verdicts` | `hero_a_id, hero_b_id, verdict, created_at` | compares total, most-compared, recent verdict text |
| `heroes` | `id, name, image_url, portrait_url, publisher` | join for hero name/thumb on leaderboards |

**Access constraint:** `favourites`/`views`/`verdicts` carry per-user RLS; cross-user
aggregation must run through an **admin-guarded `SECURITY DEFINER` RPC** (same pattern as
the existing `admin_*` functions in `catalogHealth.ts`). `auth.users` is unreadable from
the client and is only ever returned as a count by the RPC.

## Architecture (mirrors the catalog pattern)

```
supabase/migrations/<ts>_admin_engagement_overview.sql   one SECURITY DEFINER RPC
src/lib/db/engagement.ts                                  typed wrapper + EngagementOverview type
src/components/admin/health/domains/EngagementDomain.tsx  bento of Panels (reuses Panel/Bento/HeroThumb)
src/components/admin/health/format.ts                     DOMAINS: 'users' → 'engagement' (label/icon)
src/components/admin/health/hooks.ts                      useEngagement query (gated on isAdmin)
app/admin/health.web.tsx                                  route domain === 'engagement' → EngagementDomain
__tests__/components/admin/health/format.test.ts          update domain-key assertions
```

### The RPC — `admin_engagement_overview()`

One round trip returning a single JSON object. Admin-guarded: returns/raises for
non-admins exactly like the other `admin_*` RPCs (check `is_admin` on `auth.uid()`'s
profile). Shape:

```ts
interface EngagementOverview {
  totals: { members: number; favourites: number; views: number; compares: number };
  topViewed: HeroStat[];      // top 8 by view count
  topFavourited: HeroStat[];  // top 8 by favourite count
  topCompared: HeroStat[];    // top 8 by appearances across verdicts.hero_a_id + hero_b_id
  recent: ActivityItem[];     // newest 12, unified
}
interface HeroStat { id: string; name: string; image_url: string | null; publisher: string | null; count: number; }
interface ActivityItem {
  kind: 'favourite' | 'view' | 'compare';
  at: string;                 // ISO timestamp
  heroId: string;             // primary hero (hero_a for compares)
  heroName: string;
  text?: string;              // verdict text for compares
}
```

All hero leaderboards join `heroes` for `name`/`image_url`/`publisher`. Counts are computed
server-side; lists are capped (8 leaderboard rows, 12 activity rows) to stay within one
cheap query.

## UI — EngagementDomain panels (bento)

Reuses `Panel`, `Bento`/`Bento.Row`, and `HeroThumb` (with its 404 fallback) so it matches
the rest of the command center and degrades to one column under 760px.

1. **Headline stats row** — four tiles: Members · Favourites · Views · Compares.
2. **Most-viewed heroes** (top 8) — `HeroThumb` + name + publisher + view count; row taps
   to `/character/:id`.
3. **Most-favourited heroes** (top 8) — same row pattern.
4. **Most-compared heroes** (top 8) — same row pattern; count = matchup appearances.
5. **Recent activity** — unified newest-first feed: views, favourites, and verdicts (verdict
   rows show the prose text); each row icon-coded by `kind`, relative timestamp via the
   existing `relTime` helper.

Empty states: each panel shows a calm "no activity yet" message when its list is empty
(expected pre-launch).

## Data flow

`useEngagement` (React Query, `enabled: gateResolved && isAdmin`, `staleTime: 60s`) lives
alongside the other queries; the shell passes its data into `EngagementDomain` as props,
identical to how `CommandHome`/`CatalogDomain` receive theirs. No new global state.

## Out of scope (YAGNI)

- Per-user list / drill-down (only ~2 users).
- Signup / growth trends over time (too sparse pre-launch).
- Admin role management (toggling `is_admin`) — a separate admin-users concern.
- Win/loss leaderboard from verdict prose.
- Traffic / Vercel Analytics (separate future domain).

## Success criteria

- The `engagement` rail item opens a populated bento (or graceful empty states).
- All aggregates come from one admin-guarded RPC; no client-side cross-user reads.
- Non-admins cannot call the RPC.
- Leaderboard rows deep-link to the character screen; thumbnails use `HeroThumb` fallback.
- Fully responsive to one column < 760px; matches the dark-chrome/light-panel system.
- No screen/domain file over ~400 lines; data layer isolated in `engagement.ts`.
