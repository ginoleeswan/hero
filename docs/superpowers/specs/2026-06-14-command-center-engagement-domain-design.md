# Command Center — Community / Engagement Domain Design

**Date:** 2026-06-14 · **Revised:** 2026-06-17
**Status:** Approved (design phase) — revised for current schema
**Scope:** Fill the dimmed "Users" rail slot in the Mythique Command Center with a real
**Community** domain — read-only engagement + contribution analytics drawn from existing
user-activity tables.

## Priority note (read first)

Still effectively **pre-launch**: ~2 auth users, 1 profile, 5 favourites, 30 views, 82
verdicts, plus small matchup-vote / contribution volumes. An analytics domain reads very
little until there is a real user base. This remains **forward-looking scaffolding**, not
the highest-leverage work today (catalog enrichment + the Build/Sources pipelines are).
Build it when there is behaviour worth reading.

## What changed since the first draft (2026-06-14)

The app grew substantially. Relevant new facts the revised design must honour:

- **New engagement signals exist:**
  - `matchup_votes (hero_a_id, hero_b_id, picked_id, user_id, created_at)` — community
    "who would win" votes. Crucially **structured** (`picked_id`), so a real win-rate /
    most-backed-hero tally is possible (unlike free-text `verdicts`).
  - `contributions (user_id, hero_id, kind, target_field, old/new_value, status,
    reviewed_*, created_at)` — community edits, admin-vetted (status pending/approved/
    rejected).
  - `contributor_stats (user_id, approved, rejected, pending, level, updated_at)` —
    **pre-aggregated per contributor**, so a contributor leaderboard is a direct read.
- **The rail is now full** of concrete domains: Overview · Catalog · Sources · Build ·
  Campaigns · Spend, plus the two placeholders (Users, Traffic). The shared
  `Panel`/`Bento`/`HeroThumb` primitives and the per-domain file pattern are established.
- **A moderation surface already exists**: `ReviewDomain` (admin contribution review,
  nested under Catalog). This domain is **analytics only** — it must NOT duplicate the
  review queue; it links to it.

## Decisions (settled)

1. **Focus:** engagement & community signals (not membership/growth — too sparse).
2. **Rail rename:** `users` → **`community`** (label "Community", icon `people-outline`).
   "Users" implied account management, which stays deferred; "Community" covers what users
   do *and* what they contribute.
3. **Verdicts vs votes:** prefer **matchup votes** for the win/tally view (structured
   `picked_id`). Still surface *recent verdict text* as activity, but no parsed leaderboard
   from verdict prose.
4. **Contributions:** show a **contributor leaderboard** + contribution totals here
   (read-only); **defer moderation** to the existing `ReviewDomain` (link to it).
5. **Traffic / Vercel Analytics** is a **separate domain** (own spec) — out of scope here.

## Data sources (existing tables)

| Table | Used for |
|-------|----------|
| `auth.users` (count only) / `user_profiles` | member + admin counts |
| `user_favourites` | favourites total, most-favourited, recent |
| `user_view_history` | views total, most-viewed, recent |
| `verdicts` | compares total, recent verdict text |
| `matchup_votes` | votes total, most-backed heroes, biggest matchups, recent |
| `contributions` | contribution totals by status, recent |
| `contributor_stats` | contributor leaderboard (approved/level) |
| `heroes` | join for name/thumb/publisher on every hero leaderboard |

**Access constraint:** these per-user tables carry RLS; cross-user aggregation runs through
one **admin-guarded `SECURITY DEFINER` RPC** (the established `admin_*` pattern). `auth.users`
is only ever returned as a count.

## Architecture (mirrors the catalog pattern)

```
supabase/migrations/<ts>_admin_community_overview.sql     one SECURITY DEFINER RPC
src/lib/db/community.ts                                    typed wrapper + CommunityOverview type
src/components/admin/health/domains/CommunityDomain.tsx   bento of Panels (reuses Panel/Bento/HeroThumb)
src/components/admin/health/format.ts                     DOMAINS: 'users' → 'community'
src/components/admin/health/hooks.ts (or domain-local)    useCommunity query, gated on isAdmin
app/admin/health.web.tsx                                  route domain === 'community' → CommunityDomain
__tests__/components/admin/health/format.test.ts          update domain-key assertions
```

### The RPC — `admin_community_overview()`

One round trip, admin-guarded (raise/empty for non-admins like the other `admin_*` RPCs).
Returns a single JSON object:

```ts
interface CommunityOverview {
  totals: {
    members: number; favourites: number; views: number;
    compares: number; votes: number; contributions: number;
  };
  topViewed: HeroStat[];       // top 8 by view count
  topFavourited: HeroStat[];   // top 8 by favourite count
  topBacked: HeroStat[];       // top 8 heroes by matchup_votes.picked_id count (+ win rate)
  topContributors: Contributor[]; // top 8 from contributor_stats by approved desc
  contributionsByStatus: { pending: number; approved: number; rejected: number };
  recent: ActivityItem[];      // newest 12, unified
}
interface HeroStat { id: string; name: string; image_url: string | null; publisher: string | null; count: number; winRate?: number; }
interface Contributor { userId: string; displayName: string | null; approved: number; level: string | null; }
interface ActivityItem {
  kind: 'favourite' | 'view' | 'compare' | 'vote' | 'contribution';
  at: string; heroId: string; heroName: string;
  text?: string;   // verdict text (compare) or "edited <field>" (contribution)
}
```

All hero leaderboards join `heroes`; lists capped (8 leaderboard / 12 activity) for one
cheap query.

## UI — CommunityDomain panels (bento)

Reuses `Panel`, `Bento`/`Bento.Row`, `HeroThumb` (404 fallback), `relTime`. One column < 760px.

1. **Headline stats** — Members · Favourites · Views · Compares · Votes · Contributions.
2. **Most-viewed heroes** (top 8) — thumb + name + count; tap → `/character/:id`.
3. **Most-favourited heroes** (top 8).
4. **Most-backed heroes** (top 8) — matchup-vote count + win-rate chip.
5. **Top contributors** — name + approved count + level chip; header action **"Open review"**
   links to the existing `ReviewDomain` (with the `contributionsByStatus` pending count as a
   badge).
6. **Recent activity** — unified newest-first feed across all five kinds, icon-coded, `relTime`.

Each panel has a calm empty state (expected pre-launch).

## Data flow

`useCommunity` (React Query, `enabled: gateResolved && isAdmin`, `staleTime: 60s`) sits with
the other queries; the shell passes its data into `CommunityDomain` as props, exactly like
`CommandHome`/`CatalogDomain`. No new global state.

## Out of scope (YAGNI)

- Per-user list / drill-down (only ~2 users).
- Signup / growth trends over time (too sparse pre-launch).
- Admin role management (toggling `is_admin`).
- Contribution **moderation** (lives in `ReviewDomain`; this domain only links to it).
- Win/loss leaderboard parsed from verdict prose (use structured votes instead).
- Traffic / Vercel Analytics (separate spec).

## Success criteria

- The `community` rail item opens a populated bento (or graceful empty states).
- All aggregates come from one admin-guarded RPC; no client-side cross-user reads.
- Non-admins cannot call the RPC.
- Hero rows deep-link to the character screen; thumbnails use `HeroThumb` fallback.
- "Top contributors" links to `ReviewDomain`; no moderation logic duplicated here.
- Fully responsive < 760px; matches the dark-chrome/light-panel system.
- Data layer isolated in `community.ts`; domain file under ~400 lines.
