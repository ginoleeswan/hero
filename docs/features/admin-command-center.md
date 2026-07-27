# Admin command center

> The operator console at `/admin/health`: how you get in, how the six lanes
> are organised, and the patterns (metric caching, alerts, run-log streaming)
> that every new admin surface must follow. Read this before adding an admin
> panel, a new lane, or anything that touches `src/components/admin/health/`.

## Mental model (read this first)

The command center is a **web-only, single-page cockpit** over the same
Supabase project the app reads. It is not a separate app: it's one expo-router
screen (`app/admin/health.web.tsx`, ~470 lines) that mounts a shell and six
lazily-queried lanes. Three consequences:

1. **Everything is a React Query** keyed so lanes share caches — switching
   lanes is instant because the overview already warmed the data.
2. **The client is never trusted.** The gate is optimistic UI only; every
   admin RPC re-verifies `is_admin` server-side (SECURITY DEFINER). A stale
   flag yields empty results and a redirect, never data.
3. **Heavy aggregates are precomputed.** Anything that scans the ~34k-hero
   catalog goes through the metric cache (below), not a live scan on render.

**Trap:** `app/admin/health.tsx` (native) is a 7-line `Redirect` stub to
`/explore`. It must exist — expo-router throws if a route has only a `.web`
half — but it is not the place to add anything.

## Getting in

Entry point is the **Admin section on `/settings`** (`app/settings.web.tsx`),
which renders only when `useCachedAdminFlag` says so. The gate has two tiers:

- `useIsAdmin` (`src/lib/query/heroDetailQueries.ts`) — the real check, a
  query on the profile's `is_admin` flag. Non-admins get bounced to
  `/explore`; unresolved gates show the `LogoLoader`.
- `readCachedAdminFlag` / `writeCachedAdminFlag`
  (`src/hooks/useCachedAdminFlag.ts`) — last-known state in localStorage
  (`mythique.is_admin`), so a **returning admin's data queries start
  immediately** instead of waiting on session-load → admin-check round trips,
  and the settings entry renders on first paint.

## The shell

`src/components/admin/health/CommandShell.tsx` renders a left rail on desktop
and a bottom tab bar on mobile, with badges (catalog backlog, inbox count), the
alert stack, and `NotificationBell`. Tab state is **URL-persisted** via
`useUrlTabState` (`src/hooks/useUrlTabState.ts`): `?tab` selects the lane,
`?sub` the sub-tab, so a refresh restores where you were. Switching lanes
clears `?sub`; cross-lane deep jumps (`jumpTo`) land on a specific sub-tab —
e.g. Acquisition → "Build ad links" → Publish › Promote and back.

## The lanes

Six lanes, defined in `app/admin/health.web.tsx` and
`src/components/admin/health/format.ts` (`DomainKey`). Sub-tab components live
in `src/components/admin/health/domains/`.

| Lane (`?tab`) | Sub-tabs (`?sub`) | Backing components |
| --- | --- | --- |
| `command` | — | `CommandHome` — vitals, live traffic/community pulse (20–30s polls), needs-you list, jump-offs |
| `catalog` | coverage, distributions, hygiene, sources | `CatalogLane`, `SourcesDomain`, `IntegrityPanel`, `DuplicatesPanel`, `UniverseGapsPanel` |
| `pipelines` | add, enrich, generate, activity, runs, spend | `PipelinesDomain`, `AddHeroesPanel`, `BuildBoard`, `RunHistory`, `CronList`, `SpendDomain` |
| `inbox` | reports, review, comicvine | `InboxLane`, `ReportsDomain`, `ReviewDomain` (contribution review), `ComicvineReview` |
| `audience` | traffic, acquisition, community, errors | `AudienceLane`, `TrafficDomain`, `AcquisitionDomain`, `CommunityDomain`, `ErrorsDomain` (the `client_errors` feed) |
| `publish` | social, promote, insights, campaigns, debate, og | `PublishLane`, `SocialDomain`, `PromotePanel`, `SocialInsightsDomain`, `CampaignsDomain`, `DebatePickerPanel`, `OgCardsDomain` |

The old top-level tabs (Errors, Sources, Spend, OG cards, Reports…) were folded
into these lanes by the IA consolidation — don't add a seventh lane; find the
job it belongs to.

## Patterns every panel follows

- **Metric caching.** Catalog health was first collapsed to a single-pass scan
  (`supabase/migrations/20260705210000_catalog_health_single_pass.sql`,
  5,235ms → ~270ms), then put behind a **5-minute cron cache with live
  fallback** (`20260715073718_cache_admin_metrics.sql`): the RPC serves the
  cached one-row payload (~1ms) and only recomputes if the cron is down.
  Payloads are byte-identical either way, so clients never know. New expensive
  aggregates should join this cache, not add a live scan.
- **Vitals ribbon.** `VitalsBar.tsx` — backlog + ETA, ComicVine API budget
  (colour-coded against the hourly cap), active run with a universal Stop that
  halts server drains *and* the foreground `BuildBoard`, cron state, spend.
  Shown on the pipelines lane.
- **Alerts.** `buildAlerts` (`format.ts`) derives problems (API down, failed
  rows, open reports…) into the `AlertStack`; the same alerts publish to the
  global TopBar bell via `CommandAlertsContext` so mobile — which has no
  command band — still surfaces them. Cleared on unmount.
- **Activity + run logs.** `useActivityLog` and `useRunLogStream`
  (`src/components/admin/health/hooks.ts`) — local action log with flash
  toasts, plus streaming of enrichment-run rows into it.
- **Loading.** Per-lane skeletons (`src/components/admin/health/skeletons/`)
  driven by `useSkeletonTransition`, so a warm cache never flashes skeleton;
  errors render `LoadFailed` (`src/components/admin/health/ui/`) with a retry.
- **Mobile.** `usePullToRefresh` + `PullToRefreshIndicator` replace the
  desktop-only refresh button below 760px.

## The debate picker

`domains/DebatePickerPanel.tsx` (Publish › Debate) selects the daily matchup
debate. Writes go through the admin-gated `set_daily_debate` RPC via
`src/lib/db/dailyDebate.ts` — never insert into the table directly.

## Known gaps

- **Watched events have RPCs but no UI.** `admin_list_watched_events`,
  `admin_set_watched_event_approval`, and `admin_set_watched_event_enabled`
  exist in the database (see `src/types/database.generated.ts`) but nothing in
  `src/` calls them — approval currently means SQL by hand. A Pulse/events
  panel (likely an Inbox sub-tab) is the obvious home.
- **`CommunityDomain.tsx` "active visitors" is a deliberate placeholder**
  (comment at ~line 302) until page-view-based presence lands.
- The consolidation spec's follow-up — a deep design/UX polish pass — was
  explicitly deferred and hasn't happened.

## History

Design docs under `docs/superpowers/` (historical; statuses may be stale):

- `docs/superpowers/specs/2026-06-14-mythique-command-center-design.md` — the original dashboard
- `docs/superpowers/specs/2026-06-14-command-center-engagement-domain-design.md` — community/engagement panels
- `docs/superpowers/specs/2026-06-17-command-center-traffic-domain-design.md` — traffic analytics
- `docs/superpowers/specs/2026-07-08-command-center-ia-consolidation-design.md` — the 11-tabs → 5-jobs consolidation. Marked "pre-implementation" but **it shipped**: the six-lane shell in the code is this spec realised.
- `docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md` — the daily debate the picker serves
