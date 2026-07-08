# Command Center IA Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the command center's 11 tabs into 6 purpose-driven lanes (Overview / Catalog / Build / Inbox / Audience / Publish), slim the 604-line orchestrator, and kill the mobile "More" sheet.

**Architecture:** New thin "lane" components own their sub-tab state and self-fetch lane-local data; the domain registry (`format.ts DOMAINS`) becomes the single source of truth for tabs, badges, and fill behavior; `health.web.tsx` shrinks to auth gate + shell + lane switch. Existing domain panels are re-homed, not rewritten.

**Tech Stack:** Expo SDK 56 / React Native Web, expo-router, @tanstack/react-query, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-08-command-center-ia-consolidation-design.md`

## Global Constraints

- **yarn only** — never npm/bun. Tests: `yarn test:ci`. Typecheck: `yarn tsc --noEmit`.
- Commit directly to `main` (user preference), one commit per task.
- TypeScript, no `any`. `StyleSheet.create` for styles. Fonts: `Flame-Regular` display, `Nunito_*` UI (never `Flame-Bold`).
- Web-only screen: all work is in `health.web.tsx` + `src/components/admin/health/`. Do not touch `app/admin/health.tsx` (native stub).
- The command center must render and typecheck at **every commit** (new lane components land unused until the flip in Task 7).
- No visual redesign — spacing/typography polish is a separate follow-up pass.
- `narrow` breakpoint is `width < 760` everywhere.

---

### Task 1: Pure command-center logic — `buildAlerts` + backlog ETA (TDD)

The orchestrator inlines alert derivation and ETA math. Extract both as pure functions in `format.ts` so the flip (Task 7) consumes them and they're unit-testable.

**Files:**
- Modify: `src/components/admin/health/format.ts` (append at end)
- Test: `__tests__/components/admin/health/commandCenter.test.ts` (new)

**Interfaces:**
- Produces: `buildAlerts(i: AlertInputs): Alert[]`, `actionableBacklog(progress, cvFailed, pendingNow): number`, `backlogEtaLabel(runs: RunLike[], actionable: number): string | null` — all exported from `format.ts`. Task 7 imports these.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/admin/health/commandCenter.test.ts`:

```ts
import {
  buildAlerts,
  actionableBacklog,
  backlogEtaLabel,
  CV_HOURLY_CAP,
} from '../../../../src/components/admin/health/format';

describe('buildAlerts', () => {
  const base = {
    cvPing: undefined,
    cvUsage: 0,
    cvFailed: 0,
    lastRunStatus: undefined,
    unbrandedCount: 0,
    openReports: 0,
  };

  it('returns no alerts when everything is healthy', () => {
    expect(buildAlerts(base)).toEqual([]);
  });

  it('flags ComicVine rate limiting (gold)', () => {
    const a = buildAlerts({ ...base, cvPing: 'limited' });
    expect(a).toHaveLength(1);
    expect(a[0].tone).toBe('gold');
    expect(a[0].text).toMatch(/rate-limited/);
  });

  it('flags high CV usage at 80% of the cap, but not below', () => {
    expect(buildAlerts({ ...base, cvUsage: CV_HOURLY_CAP * 0.8 })).toHaveLength(1);
    expect(buildAlerts({ ...base, cvUsage: CV_HOURLY_CAP * 0.8 - 1 })).toEqual([]);
  });

  it('rate-limited wins over high usage (one CV alert, not two)', () => {
    const a = buildAlerts({ ...base, cvPing: 'limited', cvUsage: CV_HOURLY_CAP });
    expect(a.filter((x) => /ComicVine/i.test(x.text))).toHaveLength(1);
  });

  it('flags failed heroes and errored last run (red)', () => {
    const a = buildAlerts({ ...base, cvFailed: 3, lastRunStatus: 'error' });
    expect(a.map((x) => x.tone)).toEqual(['red', 'red']);
    expect(a[0].text).toMatch(/3 hero/);
  });

  it('points open reports at the Inbox lane with singular/plural copy', () => {
    expect(buildAlerts({ ...base, openReports: 1 })[0].text).toBe(
      '1 open report — see Inbox.',
    );
    expect(buildAlerts({ ...base, openReports: 2 })[0].text).toBe(
      '2 open reports — see Inbox.',
    );
  });

  it('flags unbranded heroes toward Catalog › Hygiene', () => {
    const a = buildAlerts({ ...base, unbrandedCount: 5 });
    expect(a[0].tone).toBe('gold');
    expect(a[0].text).toMatch(/Catalog › Hygiene/);
  });
});

describe('actionableBacklog', () => {
  it('falls back to pendingNow without progress data', () => {
    expect(actionableBacklog(undefined, 2, 40)).toBe(40);
  });

  it('subtracts terminal states from the total', () => {
    const progress = {
      heroesTotal: 100,
      enriched: 60,
      comicvineUnmatched: 10,
      ambiguous: 5,
      unresolved: 5,
    };
    // 100 - 60 - 3 failed - 10 - 5 - 5 = 17
    expect(actionableBacklog(progress, 3, 999)).toBe(17);
  });

  it('never goes negative', () => {
    const progress = {
      heroesTotal: 10,
      enriched: 10,
      comicvineUnmatched: 5,
      ambiguous: 0,
      unresolved: 0,
    };
    expect(actionableBacklog(progress, 5, 0)).toBe(0);
  });
});

describe('backlogEtaLabel', () => {
  it('is null with no completed drain runs', () => {
    expect(backlogEtaLabel([], 100)).toBeNull();
    expect(backlogEtaLabel([{ status: 'running', duration_ms: null, done: 0 }], 100)).toBeNull();
  });

  it('is null when nothing is actionable', () => {
    expect(
      backlogEtaLabel([{ status: 'done', duration_ms: 60_000, done: 10 }], 0),
    ).toBeNull();
  });

  it('formats minutes under an hour, hours above', () => {
    // 10 done per minute → 50 actionable = 5m; 900 actionable = 90m = 1.5h
    const runs = [{ status: 'done', duration_ms: 60_000, done: 10 }];
    expect(backlogEtaLabel(runs, 50)).toBe('~5m to clear');
    expect(backlogEtaLabel(runs, 900)).toBe('~1.5h to clear');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:ci __tests__/components/admin/health/commandCenter.test.ts`
Expected: FAIL — `buildAlerts` etc. are not exported.

- [ ] **Step 3: Implement in `format.ts`**

Append at the end of `src/components/admin/health/format.ts` (and add the type import at the top of the file: `import type { Alert } from './AlertStack';` — type-only, no cycle):

```ts
// ── Command-center alert + backlog derivations (pure, unit-tested) ────────────

/** Everything the alert stack derives from — plain values, no query objects. */
export interface AlertInputs {
  /** ComicVine ping result ('ok' | 'limited' | 'error' | undefined while loading). */
  cvPing: string | undefined;
  cvUsage: number;
  cvFailed: number;
  lastRunStatus: string | undefined;
  unbrandedCount: number;
  openReports: number;
}

/** Derive the alert list (bell + mobile banner) from current vitals. */
export function buildAlerts(i: AlertInputs): Alert[] {
  const a: Alert[] = [];
  if (i.cvPing === 'limited')
    a.push({ tone: 'gold', text: 'ComicVine is rate-limited right now — drains will mostly retry.' });
  else if (i.cvUsage >= CV_HOURLY_CAP * 0.8)
    a.push({ tone: 'gold', text: `ComicVine usage high — ${i.cvUsage}/${CV_HOURLY_CAP} calls this hour.` });
  if (i.cvFailed > 0)
    a.push({ tone: 'red', text: `${i.cvFailed} hero(es) marked failed — use "Retry failed" on the Build tab.` });
  if (i.lastRunStatus === 'error')
    a.push({ tone: 'red', text: 'The last run errored — see the Build tab.' });
  if (i.unbrandedCount > 0)
    a.push({
      tone: 'gold',
      text: `${i.unbrandedCount} character${i.unbrandedCount === 1 ? '' : 's'} need a universe — see Catalog › Hygiene.`,
    });
  if (i.openReports > 0)
    a.push({ tone: 'red', text: `${i.openReports} open report${i.openReports === 1 ? '' : 's'} — see Inbox.` });
  return a;
}

/** The subset of EnrichmentProgress the backlog math needs. */
export interface BacklogProgress {
  heroesTotal: number;
  enriched: number;
  comicvineUnmatched: number;
  ambiguous: number;
  unresolved: number;
}

/**
 * The real enrichment backlog: heroes still needing an actionable step — not yet
 * fully enriched and not terminally failed / awaiting review / unresolvable.
 */
export function actionableBacklog(
  progress: BacklogProgress | undefined,
  cvFailed: number,
  pendingNow: number,
): number {
  if (!progress) return pendingNow;
  return Math.max(
    0,
    progress.heroesTotal -
      progress.enriched -
      cvFailed -
      progress.comicvineUnmatched -
      progress.ambiguous -
      progress.unresolved,
  );
}

/** The subset of a run row the ETA math needs. */
export interface RunLike {
  status: string;
  duration_ms: number | null;
  done: number;
}

/** "~5m to clear" / "~1.5h to clear" at the observed drain rate, or null. */
export function backlogEtaLabel(runs: RunLike[], actionable: number): string | null {
  const drained = runs.filter((r) => r.duration_ms && r.done > 0);
  const ms = drained.reduce((a, r) => a + (r.duration_ms ?? 0), 0);
  const done = drained.reduce((a, r) => a + r.done, 0);
  const perMin = ms > 0 ? done / (ms / 60000) : 0;
  if (perMin <= 0 || actionable <= 0) return null;
  const etaMin = actionable / perMin;
  return etaMin >= 60 ? `~${(etaMin / 60).toFixed(1)}h to clear` : `~${Math.ceil(etaMin)}m to clear`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test:ci __tests__/components/admin/health/commandCenter.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Typecheck and commit**

```bash
yarn tsc --noEmit
git add src/components/admin/health/format.ts __tests__/components/admin/health/commandCenter.test.ts
git commit -m "refactor(command-center): extract pure alert + backlog-ETA derivations (tested)"
```

---

### Task 2: InboxLane — Reports + Review merged

**Files:**
- Create: `src/components/admin/health/domains/InboxLane.tsx`
- Modify: `src/components/admin/health/format.ts` (append `LaneJump`)

**Interfaces:**
- Consumes: `ReportsDomain()` and `ReviewDomain()` (both prop-less, self-fetching), `SubTabs`, `fetchReportsQueue(status)` from `src/lib/db/reports.ts`, `getReviewQueue()` from `src/lib/db/contributions.ts`.
- Produces: `InboxLane({ jump }: { jump?: LaneJump<InboxSub> | null })`, `type InboxSub = 'reports' | 'review'`, and in `format.ts`: `export interface LaneJump<S extends string> { sub: S; n: number }`. Task 7 renders `<InboxLane jump={inboxJump} />` and uses `LaneJump` for all lane deep-links.

- [ ] **Step 1: Add the shared jump type to `format.ts`**

Append to `src/components/admin/health/format.ts`:

```ts
/**
 * Cross-lane deep-link payload: which sub-tab to land on. `n` is a monotonically
 * increasing token so repeating the same jump re-fires the lane's effect.
 */
export interface LaneJump<S extends string> {
  sub: S;
  n: number;
}
```

- [ ] **Step 2: Create `InboxLane.tsx`**

```tsx
// Inbox lane — every queue that needs a human decision, in one place:
// user reports (pages / AI portraits / gallery images) and community
// contributions (field edits, "Did You Know" facts). Merges the old top-level
// Reports tab and the old Catalog › Review sub-tab. Sub-tab badges are live
// queue counts; both panels self-fetch and stay unchanged.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SubTabs } from '../SubTabs';
import { ReportsDomain } from './ReportsDomain';
import { ReviewDomain } from './ReviewDomain';
import { fetchReportsQueue } from '../../../../lib/db/reports';
import { getReviewQueue } from '../../../../lib/db/contributions';
import type { LaneJump } from '../format';

export type InboxSub = 'reports' | 'review';

export function InboxLane({ jump }: { jump?: LaneJump<InboxSub> | null }) {
  const [sub, setSub] = useState<InboxSub>('reports');
  useEffect(() => {
    if (jump) setSub(jump.sub);
  }, [jump]);

  // Counts share query keys with the panels (and the page-level badge), so the
  // cache is filled once and every surface agrees.
  const reportsQ = useQuery({
    queryKey: ['reportsQueue', 'open'],
    queryFn: () => fetchReportsQueue('open'),
    staleTime: 30_000,
  });
  const reviewQ = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: () => getReviewQueue(),
    staleTime: 30_000,
  });

  return (
    <>
      <SubTabs<InboxSub>
        tabs={[
          {
            key: 'reports',
            label: 'Reports',
            icon: 'flag-outline',
            badge: reportsQ.data?.length ?? 0,
          },
          {
            key: 'review',
            label: 'Review',
            icon: 'shield-checkmark-outline',
            badge: reviewQ.data?.length ?? 0,
          },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'reports' ? <ReportsDomain /> : <ReviewDomain />}
    </>
  );
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `yarn tsc --noEmit`
Expected: clean. (Component is intentionally not rendered anywhere yet.)

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/health/domains/InboxLane.tsx src/components/admin/health/format.ts
git commit -m "feat(command-center): InboxLane — Reports + Review as one moderation lane"
```

---

### Task 3: AudienceLane — Traffic + Community + Errors merged

The three read-only analytics panels become sub-tabs of one lane. Their queries **move out of `useCatalogQueries`** into the lane (self-fetching, gated on the active sub-tab) — but the removal from `useCatalogQueries` happens in Task 7 (the flip) so the app keeps working commit-by-commit.

**Files:**
- Create: `src/components/admin/health/domains/AudienceLane.tsx`

**Interfaces:**
- Consumes: `TrafficDomain({ data, loading, narrow, days, onDaysChange })`, `CommunityDomain({ data, loading, narrow, onOpenReview })`, `ErrorsDomain({ data, loading, narrow })`, `fetchTrafficOverview(days)` from `src/lib/db/traffic.ts`, `fetchCommunityOverview` from `src/lib/db/community.ts`, `fetchClientErrorOverview(days)` from `src/lib/db/clientErrors.ts`.
- Produces: `AudienceLane({ narrow, onOpenReview }: { narrow: boolean; onOpenReview: () => void })`, `type AudienceSub = 'traffic' | 'community' | 'errors'`. Task 7 renders it with `onOpenReview={() => jumpTo('inbox', 'review')}`.

- [ ] **Step 1: Create `AudienceLane.tsx`**

```tsx
// Audience lane — "how is the app doing with people": self-hosted traffic
// analytics, community engagement, and the client-error feed as sub-tabs of one
// read-only lane (formerly three top-level tabs). Each sub-tab's query runs only
// while it's active; query keys match the old page-level ones so nothing else
// changes.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SubTabs } from '../SubTabs';
import { TrafficDomain } from './TrafficDomain';
import { CommunityDomain } from './CommunityDomain';
import { ErrorsDomain } from './ErrorsDomain';
import { fetchTrafficOverview } from '../../../../lib/db/traffic';
import { fetchCommunityOverview } from '../../../../lib/db/community';
import { fetchClientErrorOverview } from '../../../../lib/db/clientErrors';

export type AudienceSub = 'traffic' | 'community' | 'errors';

export function AudienceLane({
  narrow,
  onOpenReview,
}: {
  narrow: boolean;
  onOpenReview: () => void;
}) {
  const [sub, setSub] = useState<AudienceSub>('traffic');
  const [trafficDays, setTrafficDays] = useState(28);

  const trafficQ = useQuery({
    queryKey: ['trafficOverview', trafficDays],
    queryFn: () => fetchTrafficOverview(trafficDays),
    enabled: sub === 'traffic',
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev, // keep the chart up while switching ranges
  });
  const communityQ = useQuery({
    queryKey: ['communityOverview'],
    queryFn: fetchCommunityOverview,
    enabled: sub === 'community',
    staleTime: 60_000,
  });
  const errorsQ = useQuery({
    queryKey: ['clientErrorOverview'],
    queryFn: () => fetchClientErrorOverview(7),
    enabled: sub === 'errors',
    staleTime: 60_000,
  });

  return (
    <>
      <SubTabs<AudienceSub>
        tabs={[
          { key: 'traffic', label: 'Traffic', icon: 'trending-up-outline' },
          { key: 'community', label: 'Community', icon: 'people-outline' },
          { key: 'errors', label: 'Errors', icon: 'bug-outline' },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'traffic' ? (
        <TrafficDomain
          data={trafficQ.data ?? null}
          loading={trafficQ.isLoading}
          narrow={narrow}
          days={trafficDays}
          onDaysChange={setTrafficDays}
        />
      ) : null}
      {sub === 'community' ? (
        <CommunityDomain
          data={communityQ.data ?? null}
          loading={communityQ.isLoading}
          narrow={narrow}
          onOpenReview={onOpenReview}
        />
      ) : null}
      {sub === 'errors' ? (
        <ErrorsDomain data={errorsQ.data ?? null} loading={errorsQ.isLoading} narrow={narrow} />
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit` — expected clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/AudienceLane.tsx
git commit -m "feat(command-center): AudienceLane — Traffic + Community + Errors as one lane"
```

---

### Task 4: PublishLane — Social + Campaigns merged

**Files:**
- Create: `src/components/admin/health/domains/PublishLane.tsx`

**Interfaces:**
- Consumes: `SocialDomain()`, `CampaignsDomain()` (both prop-less, self-fetching), `SubTabs`.
- Produces: `PublishLane()` (no props), `type PublishSub = 'social' | 'campaigns'`.

- [ ] **Step 1: Create `PublishLane.tsx`**

```tsx
// Publish lane — outbound content in one place: the social posting queue
// (generated by the local Social Studio) and Explore's editorial campaigns.
// Merges the old top-level Social and Campaigns tabs; both panels self-fetch.
import { useState } from 'react';
import { SubTabs } from '../SubTabs';
import { SocialDomain } from './SocialDomain';
import { CampaignsDomain } from './CampaignsDomain';

export type PublishSub = 'social' | 'campaigns';

export function PublishLane() {
  const [sub, setSub] = useState<PublishSub>('social');
  return (
    <>
      <SubTabs<PublishSub>
        tabs={[
          { key: 'social', label: 'Social', icon: 'share-social-outline' },
          { key: 'campaigns', label: 'Campaigns', icon: 'megaphone-outline' },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'social' ? <SocialDomain /> : <CampaignsDomain />}
    </>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
yarn tsc --noEmit
git add src/components/admin/health/domains/PublishLane.tsx
git commit -m "feat(command-center): PublishLane — Social + Campaigns as one outbound lane"
```

---

### Task 5: CatalogLane — Coverage · Distributions · Hygiene · Sources (Review removed)

The biggest re-home. A new lane component absorbs everything the page currently lifts for Catalog: `catSub`, `metric`, `page`, `pubFilter`, `heroQuery`, plus the gaps / distributions / hero-search / source-coverage queries. The Review sub-tab is **not** carried over (it moved to Inbox in Task 2). Sources joins as a fourth sub-tab.

**Files:**
- Create: `src/components/admin/health/domains/CatalogLane.tsx`

**Interfaces:**
- Consumes: `CatalogDomain` (existing props incl. `sub: 'coverage' | 'distributions'`, `fill`), `HeroConsole({ heroQuery, setHeroQuery, heroResults, heroSearchLoading, busy, onReenrich })`, `DuplicatesPanel({ flash, onChanged })`, `UniverseGapsPanel({ heroes, loading, flash, onChanged })`, `SourcesDomain({ cov, loading, narrow })`, `SourcesSkeleton` from `../skeletons`, db fns `getCoverageGaps`, `getCatalogDistributions`, `searchHeroesAdmin`, `fetchSourceCoverage`, `listUnbrandedHeroes` types from `src/lib/db/catalogHealth.ts`.
- Produces: `CatalogLane(props: CatalogLaneProps)` with:

```ts
export type CatalogSub = 'coverage' | 'distributions' | 'hygiene' | 'sources';
export interface CatalogJump extends LaneJump<CatalogSub> {
  metric?: CoverageMetric;
  publisher?: string | null;
}
export interface CatalogLaneProps {
  h?: CatalogHealth;
  narrow: boolean;
  anim: Animated.Value;
  unbranded: UnbrandedHero[];
  unbrandedLoading: boolean;
  busy: string | null;
  onReenrich: (id: string) => void;
  flash: (msg: string, tone?: LogTone) => void;
  jump?: CatalogJump | null;
}
```

(`UnbrandedHero` is the element type of `listUnbrandedHeroes`'s return — import the actual exported type name from `src/lib/db/catalogHealth.ts`; if it's inline, use `Awaited<ReturnType<typeof listUnbrandedHeroes>>[number]`. Check the file: `grep -n "listUnbrandedHeroes" src/lib/db/catalogHealth.ts`.)

- [ ] **Step 1: Create `CatalogLane.tsx`**

```tsx
// Catalog lane — everything about the catalogue's state: Coverage worklists,
// Distributions, Hygiene (search/re-enrich, duplicates, universe gaps), and
// Sources (per-provider coverage — provenance IS catalog health). Owns all its
// sub-tab + worklist state (formerly lifted into health.web.tsx); Review moved
// to the Inbox lane.
import { useEffect, useState } from 'react';
import { Animated, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SubTabs } from '../SubTabs';
import { CatalogDomain } from './CatalogDomain';
import { SourcesDomain } from './SourcesDomain';
import { HeroConsole } from '../HeroConsole';
import { DuplicatesPanel } from '../DuplicatesPanel';
import { UniverseGapsPanel } from '../UniverseGapsPanel';
import { SourcesSkeleton } from '../skeletons';
import {
  getCoverageGaps,
  getCatalogDistributions,
  searchHeroesAdmin,
  fetchSourceCoverage,
  type CatalogHealth,
  type CoverageMetric,
} from '../../../../lib/db/catalogHealth';
import type { LaneJump } from '../format';
import type { LogTone } from '../format';

export type CatalogSub = 'coverage' | 'distributions' | 'hygiene' | 'sources';
export interface CatalogJump extends LaneJump<CatalogSub> {
  metric?: CoverageMetric;
  publisher?: string | null;
}

export function CatalogLane({
  h,
  narrow,
  anim,
  unbranded,
  unbrandedLoading,
  busy,
  onReenrich,
  flash,
  jump,
}: {
  h?: CatalogHealth;
  narrow: boolean;
  anim: Animated.Value;
  unbranded: Awaited<ReturnType<typeof import('../../../../lib/db/catalogHealth').listUnbrandedHeroes>>;
  unbrandedLoading: boolean;
  busy: string | null;
  onReenrich: (id: string) => void;
  flash: (msg: string, tone?: LogTone) => void;
  jump?: CatalogJump | null;
}) {
  const queryClient = useQueryClient();
  const [sub, setSub] = useState<CatalogSub>('coverage');
  const [metric, setMetric] = useState<CoverageMetric>('portrait');
  const [page, setPage] = useState(0);
  const [pubFilter, setPubFilter] = useState<string | null>(null);
  const [heroQuery, setHeroQuery] = useState('');

  // Cross-lane deep-link (Overview glance → a specific worklist).
  useEffect(() => {
    if (!jump) return;
    setSub(jump.sub);
    if (jump.metric) setMetric(jump.metric);
    setPubFilter(jump.publisher ?? null);
    setPage(0);
  }, [jump]);

  const gapsQ = useQuery({
    queryKey: ['coverageGaps', metric, page, pubFilter],
    queryFn: () => getCoverageGaps(metric, { page, publisher: pubFilter }),
    enabled: sub === 'coverage' || sub === 'distributions',
    staleTime: 60_000,
  });
  const distQ = useQuery({
    queryKey: ['distributions'],
    queryFn: getCatalogDistributions,
    enabled: sub === 'distributions',
    staleTime: 60_000,
  });
  const heroSearchQ = useQuery({
    queryKey: ['adminHeroSearch', heroQuery],
    queryFn: () => searchHeroesAdmin(heroQuery),
    enabled: sub === 'hygiene' && heroQuery.trim().length >= 2,
    staleTime: 30_000,
  });
  const sourceCovQ = useQuery({
    queryKey: ['sourceCoverage'],
    queryFn: fetchSourceCoverage,
    enabled: sub === 'sources',
    staleTime: 5 * 60_000,
  });

  // Distributions → coverage drill-down (was pickPublisher in the page).
  const pickPublisher = (publisher: string) => {
    setPubFilter(publisher);
    setPage(0);
    setSub('coverage');
  };

  return (
    <>
      <SubTabs<CatalogSub>
        tabs={[
          { key: 'coverage', label: 'Coverage', icon: 'stats-chart-outline' },
          { key: 'distributions', label: 'Distributions', icon: 'pie-chart-outline' },
          { key: 'hygiene', label: 'Hygiene', icon: 'git-merge-outline', badge: unbranded.length },
          { key: 'sources', label: 'Sources', icon: 'git-network-outline' },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === 'coverage' || sub === 'distributions' ? (
        <CatalogDomain
          h={h}
          gaps={gapsQ.data}
          gapsLoading={gapsQ.isLoading}
          dist={distQ.data}
          metric={metric}
          setMetric={setMetric}
          page={page}
          setPage={setPage}
          pubFilter={pubFilter}
          setPubFilter={setPubFilter}
          pickPublisher={pickPublisher}
          anim={anim}
          narrow={narrow}
          sub={sub}
          fill={!narrow}
        />
      ) : null}
      {sub === 'hygiene' ? (
        <ScrollView style={!narrow ? { flex: 1, minHeight: 0 } : undefined} nestedScrollEnabled>
          <HeroConsole
            heroQuery={heroQuery}
            setHeroQuery={setHeroQuery}
            heroResults={heroSearchQ.data ?? []}
            heroSearchLoading={heroSearchQ.isLoading}
            busy={busy}
            onReenrich={onReenrich}
          />
          <View style={{ marginTop: 14 }}>
            <DuplicatesPanel
              flash={flash}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
                queryClient.invalidateQueries({ queryKey: ['catalogDistributions'] });
                queryClient.invalidateQueries({ queryKey: ['backfillGaps'] });
              }}
            />
          </View>
          <View style={{ marginTop: 14 }}>
            <UniverseGapsPanel
              heroes={unbranded}
              loading={unbrandedLoading}
              flash={flash}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ['unbrandedHeroes'] });
                queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
              }}
            />
          </View>
        </ScrollView>
      ) : null}
      {sub === 'sources' ? (
        sourceCovQ.isLoading ? (
          <SourcesSkeleton narrow={narrow} />
        ) : (
          <SourcesDomain cov={sourceCovQ.data} loading={sourceCovQ.isLoading} narrow={narrow} />
        )
      ) : null}
    </>
  );
}
```

**Implementation notes for this step (do these, not guesses):**
- The hygiene `<View style={{ marginTop: 14 }}>` inline styles above mirror the existing page code — move them into a `StyleSheet.create({ gapTop: { marginTop: 14 } })` in this file to honour the no-inline-styles rule the page violated.
- The `unbranded` prop type: check `src/lib/db/catalogHealth.ts` for the exported row type of `listUnbrandedHeroes` (e.g. `UnbrandedHero[]`) and use the named type instead of the `Awaited<ReturnType<…>>` fallback if one exists.
- Note the hygiene sub-tab gains a live badge (`unbranded.length`) — the count that used to hide in an alert string.
- The two inline styles `{ flex: 1, minHeight: 0 }` also become StyleSheet entries.

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit` — expected clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/CatalogLane.tsx
git commit -m "feat(command-center): CatalogLane — owns catalog sub-tabs/state, absorbs Sources, sheds Review"
```

---

### Task 6: Build lane absorbs Spend

`PipelinesDomain` already receives `data.spend`. Add a sixth sub-tab rendering the existing `SpendDomain` panel, plus a jump prop so Overview's spend card can deep-link straight to it.

**Files:**
- Modify: `src/components/admin/health/domains/PipelinesDomain.tsx`

**Interfaces:**
- Consumes: `SpendDomain({ spend, loading }: { spend?: GeminiSpend; loading: boolean })`, `LaneJump` from `../format`.
- Produces: `PipelinesDomain` accepts a new optional prop `jump?: LaneJump<BuildSub> | null` where `type BuildSub = 'add' | 'enrich' | 'generate' | 'activity' | 'runs' | 'spend'` (exported). Existing `data`/`actions`/`controls` props unchanged.

- [ ] **Step 1: Extend the sub-tab union and add the spend tab**

In `src/components/admin/health/domains/PipelinesDomain.tsx`:

1. Add imports:

```tsx
import { SpendDomain } from './SpendDomain';
import type { LaneJump } from '../format';
```

2. Export the sub union and change the state line (currently line ~81):

```tsx
export type BuildSub = 'add' | 'enrich' | 'generate' | 'activity' | 'runs' | 'spend';
// inside the component:
const [sub, setSub] = useState<BuildSub>('add');
```

3. Add `jump` to the component's props (alongside `data`, `actions`, `controls`):

```tsx
jump?: LaneJump<BuildSub> | null;
```

and apply it:

```tsx
useEffect(() => {
  if (jump) setSub(jump.sub);
}, [jump]);
```

(add `useEffect` to the existing react import.)

4. Append to the `SubTabs` tabs array (after the `runs` entry):

```tsx
{ key: 'spend', label: 'Spend', icon: 'cash-outline' },
```

5. Add the render branch after the `runs` branch, following the same `fill`-aware pattern the other sub-views use:

```tsx
{sub === 'spend' ? <SpendDomain spend={data.spend} loading={!data.spend} /> : null}
```

(`data.spend` is already in the `PipelinesData` type — verify with `grep -n "spend" src/components/admin/health/domains/pipelinesTypes.ts` and use the actual field if the type lives elsewhere.)

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit` — expected clean. The page still passes no `jump` prop (optional), so nothing else changes yet.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/PipelinesDomain.tsx
git commit -m "feat(command-center): Build lane absorbs Spend as a sub-tab (+deep-link jump prop)"
```

---

### Task 7: The flip — registry, shell, slimmed queries, rewired page

This is the switch: `DomainKey` becomes the 6-lane union, the registry drives everything (badges, fill, mobile bar), the "More" sheet dies, `useCatalogQueries` sheds the queries the lanes absorbed, and `health.web.tsx` shrinks to the auth gate + shell + lane switch using the Task 1 pure helpers.

**Files:**
- Modify: `src/components/admin/health/format.ts` (DomainKey, DomainDef, DOMAINS)
- Modify: `src/components/admin/health/CommandShell.tsx` (registry-driven nav, all-6 mobile bar, delete More sheet + placeholder rail)
- Modify: `src/components/admin/health/hooks.ts` (`useCatalogQueries` slimming, `useRunLogStream` extraction)
- Modify: `app/admin/health.web.tsx` (rewired, ~150-200 lines)
- Modify: `src/components/admin/health/domains/CommandHome.tsx` (`onOpenSpend` retarget)

**Interfaces:**
- Consumes: everything Tasks 1-6 produced.
- Produces: `DomainKey = 'command' | 'catalog' | 'pipelines' | 'inbox' | 'audience' | 'publish'`; `DomainDef` gains `fill?: boolean` and `badge?: 'pending' | 'inbox'` (drops `placeholder`); `CommandShell` prop change: `pending: number` → `badges: Partial<Record<DomainKey, number>>`, `fill` prop removed (read from registry); `useCatalogQueries` signature: `{ enabled, domain, historyLimit, ambiguousLimit }`; new `useRunLogStream(runs: RunHistoryPage['runs'] | undefined, logEvent: (tone: LogTone, text: string) => void): void` exported from `hooks.ts`.

- [ ] **Step 1: Registry (`format.ts`)**

Replace the `DomainKey` / `DomainDef` / `DOMAINS` block (lines ~153-193) with:

```ts
// ── Domains (command-center rail) — 6 purpose-driven lanes ────────────────────
export type DomainKey = 'command' | 'catalog' | 'pipelines' | 'inbox' | 'audience' | 'publish';

export interface DomainDef {
  key: DomainKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Which page-level badge count shows on this rail/tab item. */
  badge?: 'pending' | 'inbox';
  /**
   * Fill lanes lock to the viewport on desktop (the bento divides the height,
   * lists scroll within panels); non-fill lanes scroll the content region.
   */
  fill?: boolean;
}

export const DOMAINS: DomainDef[] = [
  { key: 'command', label: 'Overview', icon: 'grid', fill: true },
  { key: 'catalog', label: 'Catalog', icon: 'albums', badge: 'pending', fill: true },
  { key: 'pipelines', label: 'Build', icon: 'construct-outline', fill: true },
  { key: 'inbox', label: 'Inbox', icon: 'file-tray-full-outline', badge: 'inbox' },
  { key: 'audience', label: 'Audience', icon: 'people-outline' },
  { key: 'publish', label: 'Publish', icon: 'megaphone-outline' },
];
```

Delete `primaryDomainKeys` (no placeholders remain; grep for usages first: `rg -n "primaryDomainKeys" src app`).

- [ ] **Step 2: CommandShell — registry-driven, all-6 mobile bar, no More sheet**

In `src/components/admin/health/CommandShell.tsx`:

1. Delete `MOBILE_TABS`, the `moreOpen` state, the entire More-sheet JSX block (`{narrow && moreOpen && …}`), and the More button in the bottom bar (the trailing IIFE).
2. Props: replace `pending: number` with `badges: Partial<Record<DomainKey, number>>`; delete the `fill` prop. Derive inside:

```tsx
const def = DOMAINS.find((d) => d.key === domain);
const fill = !!def?.fill;
const badgeFor = (d: DomainDef) => (d.badge ? badges[d.key] : undefined);
```

3. Desktop rail: one loop over `DOMAINS` (delete the `primary`/`future` split and the `railDivider` between them):

```tsx
{DOMAINS.map((d) => (
  <RailItem key={d.key} def={d} on={domain === d.key} badge={badgeFor(d)} onPress={() => onDomain(d.key)} />
))}
```

4. Mobile bottom bar: map all 6 `DOMAINS` (replacing `mobilePrimary`), same item JSX, using `badgeFor(d)`. Six items at `flex: 1` fit a 390-pt iPhone (~65pt each); keep `btabLabel` at `fontSize: 11` and add `numberOfLines={1}` to the label so "Audience" never wraps.
5. Delete now-unused styles: `moreScrim`, `moreSheet`, `moreTitle`, `moreRow`, `moreRowOn`, `moreRowText`, `moreRowTextOn`, `railDivider`, `railItemDim`.
6. `RailItem`'s `def.placeholder` reference goes away with the field.

- [ ] **Step 3: hooks.ts — slim `useCatalogQueries`, add `useRunLogStream`**

1. `useCatalogQueries` params become `{ enabled, domain, historyLimit, ambiguousLimit }` — delete `metric`, `page`, `pubFilter`, `heroQuery`, `trafficDays` (and their uses).
2. Delete these queries (moved into lanes): `heroSearchQ`, `distQ`, `communityQ`, `trafficQ`, `errorsQ`. Delete the `onSpend/onCommunity/onTraffic/onErrors` flags. Remove the now-unused imports (`searchHeroesAdmin`, `getCatalogDistributions`, `fetchCommunityOverview`, `fetchTrafficOverview`, `fetchClientErrorOverview`).
3. `gapsQ` becomes the Overview glance's fixed default (cache key matches what CatalogLane uses for its own defaults, so no double fetch):

```ts
const gapsQ = useQuery({
  queryKey: ['coverageGaps', 'portrait', 0, null],
  queryFn: () => getCoverageGaps('portrait', { page: 0, publisher: null }),
  enabled: enabled && onHome,
  staleTime: 60_000,
});
```

4. `spendQ` gate: `enabled: enabled && (onHome || onBuild)` (the standalone Spend tab is gone).
5. Append the run-log streaming hook (moved verbatim from `health.web.tsx` lines ~206-239):

```ts
/**
 * Stream run state changes into the activity log. The first batch only primes
 * the seen-map (so existing history doesn't flood the log on mount); after that
 * every transition — started, done, error, stopped — is logged with detail.
 */
export function useRunLogStream(
  runs: RunHistoryPage['runs'] | undefined,
  logEvent: (tone: LogTone, text: string) => void,
) {
  const seen = useRef<Map<number, string>>(new Map());
  const primed = useRef(false);
  useEffect(() => {
    if (!runs) return;
    if (!primed.current) {
      for (const r of runs) seen.current.set(r.id, r.status);
      primed.current = true;
      return;
    }
    for (const r of runs) {
      const prev = seen.current.get(r.id);
      if (prev === r.status) continue;
      seen.current.set(r.id, r.status);
      const took = r.duration_ms != null ? ` in ${(r.duration_ms / 1000).toFixed(1)}s` : '';
      if (r.status === 'running' && prev == null) {
        logEvent('pending', `Run #${r.id} started · ${r.triggered_by}`);
      } else if (r.status === 'done') {
        logEvent(
          'success',
          `Run #${r.id} finished · ${r.done} enriched${r.failed ? `, ${r.failed} failed` : ''}${
            r.retry ? `, ${r.retry} retry` : ''
          }${took}`,
        );
      } else if (r.status === 'error') {
        logEvent('error', `Run #${r.id} errored${r.done ? ` after ${r.done} enriched` : ''}${took}`);
      } else if (r.status === 'stopped') {
        logEvent('info', `Run #${r.id} stopped · ${r.done} enriched${took}`);
      }
    }
  }, [runs, logEvent]);
}
```

- [ ] **Step 4: CommandHome — retarget the spend deep-link**

In `src/components/admin/health/domains/CommandHome.tsx`, the `onOpenSpend` prop stays (two call sites, lines ~181 and ~232) — only the page's implementation changes (next step). No edit needed here beyond confirming the prop name; if the prop doc comment says "opens the Spend tab", update it to "opens Build › Spend".

- [ ] **Step 5: Rewire `app/admin/health.web.tsx`**

Rewrite the component body. Target shape (complete listing of the parts that change; auth gate, PTR block, profile/unbranded/reports queries, `useScreenChrome`, `LogoLoader` gate, and the `BuildBoard` overlay stay as they are):

```tsx
// State (replaces the old 10-piece lifted state):
const [domain, setDomain] = useState<DomainKey>('command');
const [batchSize, setBatchSize] = useState(25);
const [historyLimit, setHistoryLimit] = useState(30);
const [ambiguousLimit, setAmbiguousLimit] = useState(25);
const [buildIds, setBuildIds] = useState<string[] | null>(null);
// Cross-lane deep-links: monotonically increasing token per lane.
const [catalogJump, setCatalogJump] = useState<CatalogJump | null>(null);
const [inboxJump, setInboxJump] = useState<LaneJump<InboxSub> | null>(null);
const [buildJump, setBuildJump] = useState<LaneJump<BuildSub> | null>(null);

const jumpCatalog = (j: Omit<CatalogJump, 'n'>) => {
  setCatalogJump({ ...j, n: (catalogJump?.n ?? 0) + 1 });
  setDomain('catalog');
};
const jumpInbox = (sub: InboxSub) => {
  setInboxJump({ sub, n: (inboxJump?.n ?? 0) + 1 });
  setDomain('inbox');
};
const jumpBuild = (sub: BuildSub) => {
  setBuildJump({ sub, n: (buildJump?.n ?? 0) + 1 });
  setDomain('pipelines');
};

// Review-queue count for the Inbox rail badge (shares the lane's cache key).
const reviewQ = useQuery({
  queryKey: ['reviewQueue'],
  queryFn: () => getReviewQueue(),
  enabled: gateResolved && isAdmin,
  staleTime: 30_000,
});

// Queries (slimmed hook):
const { healthQ, gapsQ, runsQ, cronQ, pingQ, usageQ, snapsQ, spendQ, ambiguousQ,
  enrichProgressQ, statsPendingQ, portraitsPendingQ, recentEnrichedQ } =
  useCatalogQueries({ enabled: gateResolved && isAdmin, domain, historyLimit, ambiguousLimit });

// Run-log streaming (extracted hook):
useRunLogStream(runsQ.data?.runs, logEvent);

// Alerts (pure helper from Task 1):
const alerts = useMemo<Alert[]>(
  () =>
    buildAlerts({
      cvPing: pingQ.data,
      cvUsage: usageQ.data ?? 0,
      cvFailed: h?.cvStatus.failed ?? 0,
      lastRunStatus: runsQ.data?.runs[0]?.status,
      unbrandedCount: unbrandedQ.data?.length ?? 0,
      openReports: openReportsQ.data?.length ?? 0,
    }),
  [pingQ.data, usageQ.data, h, runsQ.data, unbrandedQ.data, openReportsQ.data],
);

// Backlog vitals (pure helpers from Task 1):
const pendingNow = h?.cvStatus.pending ?? 0;
const actionable = actionableBacklog(enrichProgressQ.data, h?.cvStatus.failed ?? 0, pendingNow);
const etaLabel = backlogEtaLabel(runsQ.data?.runs ?? [], actionable);

// Rail/tab badges from the registry's badge keys:
const badges: Partial<Record<DomainKey, number>> = {
  catalog: pendingNow,
  inbox: (openReportsQ.data?.length ?? 0) + (reviewQ.data?.length ?? 0),
};
```

The shell + lane switch:

```tsx
<CommandShell
  domain={domain}
  onDomain={setDomain}
  overall={overall}
  badges={badges}
  refreshing={refreshing}
  onRefresh={onRefresh}
  narrow={narrow}
  ribbon={domain === 'pipelines' ? ribbon : null}
  alerts={alerts}
>
  {domain === 'command' &&
    (h ? (
      <CommandHome
        h={h}
        overall={overall}
        snaps={snapsQ.data ?? []}
        gaps={gapsQ.data}
        spend={spendQ.data}
        progress={enrichProgressQ.data}
        narrow={narrow}
        onJump={(m) => jumpCatalog({ sub: 'coverage', metric: m })}
        onOpenSpend={() => jumpBuild('spend')}
        onOpenBuild={() => setDomain('pipelines')}
        onSnapshot={onSnapshot}
        snapshotting={busy === 'snapshot'}
      />
    ) : showHealthSkeleton ? (
      <CommandHomeSkeleton narrow={narrow} />
    ) : null)}
  {domain === 'catalog' &&
    (h ? (
      <Bento fill={!narrow}>
        <CatalogLane
          h={h}
          narrow={narrow}
          anim={anim}
          unbranded={unbrandedQ.data ?? []}
          unbrandedLoading={unbrandedQ.isLoading}
          busy={busy}
          onReenrich={onReenrich}
          flash={flash}
          jump={catalogJump}
        />
      </Bento>
    ) : showHealthSkeleton ? (
      <CatalogSkeleton narrow={narrow} />
    ) : null)}
  {domain === 'pipelines' &&
    (h ? (
      <PipelinesDomain data={…unchanged…} actions={…unchanged…} controls={…unchanged…} jump={buildJump} />
    ) : showHealthSkeleton ? (
      <PipelinesSkeleton narrow={narrow} />
    ) : null)}
  {domain === 'inbox' && <InboxLane jump={inboxJump} />}
  {domain === 'audience' && (
    <AudienceLane narrow={narrow} onOpenReview={() => jumpInbox('review')} />
  )}
  {domain === 'publish' && <PublishLane />}
</CommandShell>
```

**Deletions in the page:** `metric/setMetric`, `catSub/setCatSub`, `page/setPage`, `heroQuery/setHeroQuery`, `pubFilter/setPubFilter`, `trafficDays/setTrafficDays`, `sourceCovQ`, `pickPublisher`, `goToBackfill` (replaced by `jumpCatalog`), the inline run-log effect, the inline alerts memo, the inline ETA math block, the `fill={…}` ladder (shell reads the registry), and the imports that go with them (`SubTabs`, `HeroConsole`, `DuplicatesPanel`, `UniverseGapsPanel`, `SourcesDomain`, `SpendDomain`, `TrafficDomain`, `CommunityDomain`, `ErrorsDomain`, `ReportsDomain`, `ReviewDomain`, `CatalogDomain`, `ScrollView`, `fetchSourceCoverage`, `fetchReportsQueue` stays for `openReportsQ`).

**New imports in the page:** `CatalogLane`/`CatalogJump`, `InboxLane`/`InboxSub`, `AudienceLane`, `PublishLane`, `BuildSub`, `LaneJump`, `buildAlerts`, `actionableBacklog`, `backlogEtaLabel`, `useRunLogStream`, `getReviewQueue`.

`PipelinesDomain`'s `data`/`actions`/`controls` objects are unchanged from the current file (lines ~489-529) — copy them as-is, adding the `jump={buildJump}` prop. The `keepPreviousData`-style behavior, VitalsBar wiring, `onlyOnBuild`, PTR, and BuildBoard overlay all stay exactly as they are.

- [ ] **Step 6: Full verification**

```bash
yarn tsc --noEmit        # expected: clean
yarn test:ci             # expected: all pass (incl. Task 1 tests)
rg -n "sources'|'spend'|'community'|'traffic'|'errors'|'reports'|'campaigns'|'social'" src/components/admin/health/format.ts src/components/admin/health/CommandShell.tsx app/admin/health.web.tsx
# expected: no DomainKey references to retired keys (string literals inside lane
# components' own SubTab unions are fine)
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(command-center): the flip — 6-lane IA, registry-driven shell, More sheet retired, orchestrator slimmed"
```

---

### Task 8: Cleanup, dead code, and device-verification handoff

**Files:**
- Delete: `src/components/admin/health/domains/PlaceholderDomain.tsx` (nothing references it after the flip — verify)
- Modify: any file the greps below surface

- [ ] **Step 1: Dead-code sweep**

```bash
rg -n "PlaceholderDomain" src app          # expect: no hits → delete the file
rg -n "primaryDomainKeys" src app          # expect: no hits (deleted in Task 7)
rg -n "SpendSkeleton|SourcesSkeleton|CommunitySkeleton|TrafficSkeleton|ErrorsSkeleton" src
# Any skeleton now unreferenced (SpendSkeleton likely) → remove its export from
# src/components/admin/health/skeletons/index.tsx
rg -n "onOpenSpend" src                    # confirm CommandHome's prop doc matches Build › Spend
```

Delete what's confirmed dead. Do NOT delete `SpendDomain.tsx` (now rendered inside PipelinesDomain) or any domain panel.

- [ ] **Step 2: Mobile spill audit on the merged lanes**

Check each lane renders correctly narrow (the Panel flex-spill class of bug — see memory `project_command_center_panel_flex_spill`):
- Lanes rendered inside `Bento` must gate `fill` on `!narrow` (CatalogLane already does via the page).
- InboxLane/AudienceLane/PublishLane are scroll lanes (no `fill` in the registry) — confirm no child sets `flex: 1` on a narrow layout.

```bash
rg -n "flex: 1" src/components/admin/health/domains/InboxLane.tsx src/components/admin/health/domains/AudienceLane.tsx src/components/admin/health/domains/PublishLane.tsx
# expect: no hits
```

- [ ] **Step 3: Full test + typecheck + lint**

```bash
yarn tsc --noEmit && yarn test:ci && yarn lint
```

Expected: clean / all pass / no new errors (warnings are the intentional ratchet backlog).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(command-center): retire PlaceholderDomain + dead skeletons; narrow-layout audit"
```

- [ ] **Step 5: Hand off for device verification**

Per the user's flow (they screenshot iOS Safari on their own device — do NOT spin up a local server): ask the user to check, on **both** desktop and iPhone:
1. All 6 lanes reachable; mobile bottom bar shows all 6 with no More sheet.
2. Catalog: Coverage/Distributions/Hygiene/Sources sub-tabs; publisher drill-down from Distributions still lands on Coverage filtered.
3. Overview: gap card jump lands on Catalog › Coverage with the right metric; spend card lands on Build › Spend.
4. Inbox badge = open reports + pending review; Audience › Community "Open review" lands on Inbox › Review.
5. Build: all six sub-tabs incl. Spend; run a small drain to confirm the activity log still streams.

---

## Self-review notes (already applied)

- **Spec coverage:** registry (T7), merged lanes (T2-4), fold-ins (T5-6), orchestrator slim + hooks (T1, T7), More-sheet death + all-6 mobile bar (T7), skeleton for Sources sub (T5), deep-link remaps (T7), alert copy → Inbox (T1), PlaceholderDomain removal (T8), tests for extracted logic (T1).
- **Known judgment calls:** Overview's gaps glance now always uses the portrait/first-page defaults (previously it incidentally followed Catalog's lifted metric state); Hygiene sub-tab gains an unbranded-count badge.
- **Type-name risks flagged inline:** `UnbrandedHero` row type (T5) and `PipelinesData.spend` field (T6) must be verified against the actual source before use.
