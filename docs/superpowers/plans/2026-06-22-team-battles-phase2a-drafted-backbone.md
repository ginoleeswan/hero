# Team Battles — Phase 2a (Drafted Battle Backbone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the clash page able to resolve and render *any* custom matchup of arbitrary heroes (1–5 per side, asymmetric), reachable at `/versus/team/draft?a=<ids>&b=<ids>`, reusing the existing `ClashArena` — the foundation the Phase 2b Battle Builder will produce drafts for.

**Architecture:** A drafted battle is encoded entirely in the URL (`?a=id1,id2&b=id3,id4`) so it's reload-safe and shareable. A pure `resolveBattleRoute()` decides where a built matchup goes (1×1 → the existing `/compare` arena; anything larger → the draft route). A new `useDraftBattle` hook fetches the two rosters (`getDraftRoster`), computes synergy (`get_team_synergy`, already built), and runs the pure `resolveTeamBattle` engine — sides are named after their captain, use the deterministic engine verdict, and are not community-votable (no stable pair id). `ClashArena` gains a `votable` flag to hide voting for drafts.

**Tech Stack:** TypeScript, Expo Router 4, React Native / web, react-query, Supabase, jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-22-team-battles-design.md` (Phase 2 — Unified Battle Builder)

## Global Constraints

- Package manager: **yarn** only. Tests: `yarn test:ci`.
- TypeScript throughout — no `any`; `unknown` for caught errors.
- Screens never import `supabase` directly — all DB access via `src/lib/db/`. Readers degrade gracefully (return `[]`/`null`, never throw).
- Reuse the existing team-battle engine and components from Phase 1: `resolveTeamBattle` + types in `src/lib/teamBattle.ts`, `get_team_synergy` via `getTeamSynergy` in `src/lib/db/teams.ts`, and `ClashArena` in `src/components/versus/ClashArena.tsx`.
- `RosterHero` (from `src/lib/teamBattle.ts`) is the roster shape: `{ id, name, portrait_url?, image_url?, intelligence, strength, speed, durability, power, combat }` (stats `number | null`).
- Sides cap at **5**; a side is 1–5 heroes; a `1 × 1` battle is delegated to the existing 1v1 arena (`/compare/[hero]/[opponent]`), never the draft route.
- Platform pairs (`foo.tsx`/`foo.web.tsx`): both must exist or expo-router throws; shared fetch/state lives in a platform-neutral hook.
- Fonts: `Flame-Regular` (display), `Nunito_*` (UI). Never `Flame-Bold`. Styles via `StyleSheet.create`.
- Faction colors come from `src/components/versus/factionColors.ts` (`FACTION_A`/`FACTION_B`); navy stage from `COLORS.deepNavy`.

---

## File Structure

**Source (new):**
- `src/lib/battleRoute.ts` — pure `resolveBattleRoute(aIds, bIds)` deciding the destination path
- `src/hooks/useDraftBattle.ts` — resolves a drafted matchup into `{ sideA, sideB, result }`
- `app/versus/team/draft.tsx` + `.web.tsx` — the drafted clash route

**Source (modify):**
- `src/lib/db/teams.ts` — add `getDraftRoster(ids)` (heroes by id, with stats, in order)
- `src/components/versus/ClashArena.tsx` — add `votable` prop (hide votes/tally when false); thread through `DesktopDuel`/mobile → `VerdictVotes`

**Tests (new):**
- `__tests__/lib/battleRoute.test.ts`
- `__tests__/lib/db/teamsDraft.test.ts`

---

## Task 1: `getDraftRoster(ids)` — fetch heroes by id with stats, in order

**Files:**
- Modify: `src/lib/db/teams.ts`
- Test: `__tests__/lib/db/teamsDraft.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabase`; `RosterHero` from `../teamBattle`.
- Produces: `export function getDraftRoster(ids: string[]): Promise<RosterHero[]>` — returns the heroes whose ids are in `ids`, **in the same order as `ids`**, capped at 5, each with stat columns. Missing ids are skipped. `[]` on error or empty input.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/teamsDraft.test.ts`:

```ts
const fromMock = jest.fn();
jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }));

import { getDraftRoster } from '../../../src/lib/db/teams';

function mockSelect(rows: unknown[] | null, error: { message: string } | null) {
  // .from('heroes').select(cols).in('id', ids) resolves to { data, error }
  const inFn = jest.fn().mockResolvedValue({ data: rows, error });
  const selectFn = jest.fn().mockReturnValue({ in: inFn });
  fromMock.mockReturnValue({ select: selectFn });
}

describe('getDraftRoster', () => {
  beforeEach(() => fromMock.mockReset());

  it('returns [] for empty input without querying', async () => {
    const r = await getDraftRoster([]);
    expect(r).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns heroes in the order of the requested ids (not DB order)', async () => {
    mockSelect(
      [
        { id: 'b', name: 'B', intelligence: 1, strength: 1, speed: 1, durability: 1, power: 1, combat: 1 },
        { id: 'a', name: 'A', intelligence: 2, strength: 2, speed: 2, durability: 2, power: 2, combat: 2 },
      ],
      null,
    );
    const r = await getDraftRoster(['a', 'b']);
    expect(r.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('skips ids with no matching hero', async () => {
    mockSelect([{ id: 'a', name: 'A', intelligence: 1, strength: 1, speed: 1, durability: 1, power: 1, combat: 1 }], null);
    const r = await getDraftRoster(['a', 'missing']);
    expect(r.map((h) => h.id)).toEqual(['a']);
  });

  it('caps at 5 ids', async () => {
    mockSelect([], null);
    await getDraftRoster(['1', '2', '3', '4', '5', '6', '7']);
    const inArg = (fromMock.mock.results[0].value.select.mock.results[0].value.in as jest.Mock).mock.calls[0][1];
    expect(inArg).toHaveLength(5);
  });

  it('returns [] on error', async () => {
    mockSelect(null, { message: 'boom' });
    const r = await getDraftRoster(['a']);
    expect(r).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/teamsDraft.test.ts`
Expected: FAIL — `getDraftRoster` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db/teams.ts`:

```ts
import type { RosterHero } from '../teamBattle';
// (RosterHero may already be imported at the top of this file; if so, don't duplicate the import.)

const DRAFT_COLS = 'id, name, portrait_url, image_url, intelligence, strength, speed, durability, power, combat';

/**
 * Fetch up to five heroes by id for a drafted battle side, returned in the same
 * order as `ids` (Postgres `in()` does not preserve order). Missing ids are
 * dropped. Degrades to `[]` on error — the clash page hides an empty side.
 */
export async function getDraftRoster(ids: string[]): Promise<RosterHero[]> {
  const wanted = ids.slice(0, 5);
  if (wanted.length === 0) return [];
  const { data, error } = await supabase.from('heroes').select(DRAFT_COLS).in('id', wanted);
  if (error) {
    console.warn('[getDraftRoster] error:', error.message);
    return [];
  }
  const byId = new Map((data ?? []).map((h) => [(h as RosterHero).id, h as unknown as RosterHero]));
  return wanted.map((id) => byId.get(id)).filter((h): h is RosterHero => !!h);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/teamsDraft.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
yarn tsc --noEmit
git add src/lib/db/teams.ts __tests__/lib/db/teamsDraft.test.ts
git commit -m "feat(versus): getDraftRoster — heroes by id with stats, in order"
```

---

## Task 2: `resolveBattleRoute` — route a built matchup by size

**Files:**
- Create: `src/lib/battleRoute.ts`
- Test: `__tests__/lib/battleRoute.test.ts`

**Interfaces:**
- Produces: `export function resolveBattleRoute(aIds: string[], bIds: string[]): string | null`.
  - `null` if either side is empty.
  - `1 × 1` → `"/compare/<a>/<b>"` (the existing 1v1 arena).
  - otherwise → `"/versus/team/draft?a=<aIds joined by ,>&b=<bIds joined by ,>"` (ids URL-encoded).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/battleRoute.test.ts`:

```ts
import { resolveBattleRoute } from '../../src/lib/battleRoute';

describe('resolveBattleRoute', () => {
  it('returns null when a side is empty', () => {
    expect(resolveBattleRoute([], ['x'])).toBeNull();
    expect(resolveBattleRoute(['x'], [])).toBeNull();
  });

  it('routes 1v1 to the existing compare arena', () => {
    expect(resolveBattleRoute(['superman'], ['batman'])).toBe('/compare/superman/batman');
  });

  it('routes any team size to the draft route with both rosters', () => {
    expect(resolveBattleRoute(['a', 'b', 'c'], ['x', 'y'])).toBe('/versus/team/draft?a=a%2Cb%2Cc&b=x%2Cy');
  });

  it('treats N-vs-1 as a team battle (not the 1v1 arena)', () => {
    expect(resolveBattleRoute(['a', 'b'], ['x'])).toBe('/versus/team/draft?a=a%2Cb&b=x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:ci __tests__/lib/battleRoute.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

Create `src/lib/battleRoute.ts`:

```ts
/**
 * Decide where a built matchup goes. A 1-v-1 reuses the proven single-pair arena
 * at /compare/[hero]/[opponent]; anything larger (or asymmetric) becomes a drafted
 * team battle whose two rosters travel in the URL so it is reload-safe and
 * shareable. Returns null when a side is empty.
 */
export function resolveBattleRoute(aIds: string[], bIds: string[]): string | null {
  if (aIds.length === 0 || bIds.length === 0) return null;
  if (aIds.length === 1 && bIds.length === 1) {
    return `/compare/${aIds[0]}/${bIds[0]}`;
  }
  const a = encodeURIComponent(aIds.join(','));
  const b = encodeURIComponent(bIds.join(','));
  return `/versus/team/draft?a=${a}&b=${b}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:ci __tests__/lib/battleRoute.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battleRoute.ts __tests__/lib/battleRoute.test.ts
git commit -m "feat(versus): resolveBattleRoute — route a matchup by size"
```

---

## Task 3: `useDraftBattle` — resolve a drafted matchup

**Files:**
- Create: `src/hooks/useDraftBattle.ts`

**Interfaces:**
- Consumes: `getDraftRoster`, `getTeamSynergy` from `../lib/db/teams`; `resolveTeamBattle`, `type TeamSide`, `type TeamBattleResult` from `../lib/teamBattle`; `useQuery` from `@tanstack/react-query`.
- Produces:
  ```ts
  export interface UseDraftBattle {
    loading: boolean;
    sideA: TeamSide | null;
    sideB: TeamSide | null;
    result: TeamBattleResult | null;
  }
  export function useDraftBattle(aIds: string[], bIds: string[]): UseDraftBattle;
  ```
- Each side's `team` is named after its captain (`roster[0].name`); `team.id` is `'draft-a'`/`'draft-b'`. Verdict is the deterministic one from `resolveTeamBattle` (no AI/cache for drafts in this phase). No tally/voting.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useDraftBattle.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { getDraftRoster, getTeamSynergy } from '../lib/db/teams';
import { resolveTeamBattle, type TeamSide, type TeamBattleResult, type RosterHero } from '../lib/teamBattle';

export interface UseDraftBattle {
  loading: boolean;
  sideA: TeamSide | null;
  sideB: TeamSide | null;
  result: TeamBattleResult | null;
}

async function buildDraftSide(ids: string[], id: 'draft-a' | 'draft-b'): Promise<TeamSide | null> {
  const roster: RosterHero[] = await getDraftRoster(ids);
  if (roster.length === 0) return null;
  const synergy = await getTeamSynergy(roster.map((h) => h.id));
  const captain = roster[0];
  return {
    team: { id, name: captain?.name ?? 'Team', publisher: null, logo_url: null },
    roster,
    synergy,
  };
}

/** Resolve a drafted matchup (arbitrary hero ids per side) into two TeamSides and
 *  the engine verdict. Cached by the id lists so a reload re-resolves cleanly. */
export function useDraftBattle(aIds: string[], bIds: string[]): UseDraftBattle {
  const key = `${aIds.join(',')}|${bIds.join(',')}`;
  const q = useQuery({
    queryKey: ['draftBattle', key],
    staleTime: 1000 * 60 * 30,
    enabled: aIds.length > 0 && bIds.length > 0,
    queryFn: async () => {
      const [sideA, sideB] = await Promise.all([buildDraftSide(aIds, 'draft-a'), buildDraftSide(bIds, 'draft-b')]);
      if (!sideA || !sideB) return null;
      return { sideA, sideB, result: resolveTeamBattle(sideA, sideB) };
    },
  });

  const d = q.data ?? null;
  return {
    loading: q.isPending,
    sideA: d?.sideA ?? null,
    sideB: d?.sideB ?? null,
    result: d?.result ?? null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0. (Confirms `getDraftRoster`/`getTeamSynergy`/`resolveTeamBattle` signatures line up.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDraftBattle.ts
git commit -m "feat(versus): useDraftBattle — resolve an arbitrary drafted matchup"
```

---

## Task 4: `ClashArena` `votable` flag (hide voting for drafts)

**Files:**
- Modify: `src/components/versus/ClashArena.tsx`

**Interfaces:**
- Consumes: existing `ClashArena` props.
- Produces: `ClashArena` accepts `votable?: boolean` (default `true`). When `false`, `VerdictVotes` renders the verdict only — no vote buttons, no tally. Threaded `ClashArena → DesktopDuel`/mobile branch → `VerdictVotes`.

- [ ] **Step 1: Add the prop to `ClashArena` and thread it**

In `src/components/versus/ClashArena.tsx`:

1. Add to the `Props` interface: `votable?: boolean;`
2. Destructure with a default in the component signature: `votable = true`.
3. Pass `votable` to `DesktopDuel` (add it to `DesktopDuel`'s props and the call) and to the mobile-branch `VerdictVotes`.
4. In `DesktopDuel`, add `votable: boolean` to its props and pass it to the `VerdictVotes` it renders.
5. In `VerdictVotes`, add `votable?: boolean` (default `true`) to its props type, and wrap the votes + tally block so it only renders when `votable`:

```tsx
{votable ? (
  <>
    <Animated.View entering={animate ? FadeIn.delay(T_VERDICT + 90) : undefined} style={styles.votes}>
      <VoteButton tint={TINT_A} name={nameA} onPress={() => sideA.team && onVote(sideA.team.id)} />
      <VoteButton tint={TINT_B} name={nameB} onPress={() => sideB.team && onVote(sideB.team.id)} />
    </Animated.View>
    {tally && tally.total > 0 ? (
      <Text style={styles.tally}>
        {tally.votesA} – {tally.votesB} · {tally.total} {tally.total === 1 ? 'vote' : 'votes'}
      </Text>
    ) : null}
  </>
) : null}
```

(The verdict eyebrow + sentence block above stays unconditional.)

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Verify the curated path is unchanged**

Run `yarn start`, open `/versus/team/avengers-vs-x-men` (web or native) and confirm the vote buttons + tally still show (votable defaults to true, so the curated daily battle is unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/components/versus/ClashArena.tsx
git commit -m "feat(versus): ClashArena votable flag (hide voting for drafted battles)"
```

---

## Task 5: The drafted clash route `/versus/team/draft`

**Files:**
- Create: `app/versus/team/draft.tsx`
- Create: `app/versus/team/draft.web.tsx`

**Interfaces:**
- Consumes: `useDraftBattle` from `src/hooks/useDraftBattle`; `ClashArena`; `useLocalSearchParams` from `expo-router`. Web also: `useScreenChrome`, `SURFACE`, `TOPBAR_HEIGHT`.
- Reads `?a=` and `?b=` query params (comma-joined hero ids). Renders `ClashArena` with `votable={false}`.

- [ ] **Step 1: Parse helper (inline, both files use it)**

Both route files use this query parser (define it locally in each file — it's two lines):

```tsx
function parseIds(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5);
}
```

- [ ] **Step 2: Native route**

Create `app/versus/team/draft.tsx`:

```tsx
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../src/constants/colors';
import { useDraftBattle } from '../../../src/hooks/useDraftBattle';
import { ClashArena } from '../../../src/components/versus/ClashArena';

function parseIds(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5);
}

export default function DraftClashScreen() {
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const insets = useSafeAreaInsets();
  const aIds = parseIds(params.a);
  const bIds = parseIds(params.b);
  const { loading, sideA, sideB, result } = useDraftBattle(aIds, bIds);

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={COLORS.goldAccent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ClashArena
          sideA={sideA}
          sideB={sideB}
          result={result}
          tally={null}
          onVote={() => {}}
          votable={false}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 3: Web route**

Create `app/versus/team/draft.web.tsx`:

```tsx
import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useDraftBattle } from '../../../src/hooks/useDraftBattle';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { ClashArena } from '../../../src/components/versus/ClashArena';

function parseIds(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5);
}

export default function DraftClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const aIds = parseIds(params.a);
  const bIds = parseIds(params.b);
  const { loading, sideA, sideB, result } = useDraftBattle(aIds, bIds);

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.goldAccent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ClashArena
        sideA={sideA}
        sideB={sideB}
        result={result}
        tally={null}
        onVote={() => {}}
        votable={false}
        topInset={TOPBAR_HEIGHT}
        bottomInset={40}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flexGrow: 1 },
  center: { flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.deepNavy },
});
```

- [ ] **Step 4: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Manual verification**

Pick real hero ids from the DB (e.g., via `mcp__supabase__execute_sql`: `select id, name from public.get_team_roster('avengers', 3)` and `... 'watchmen', 2`). Launch the app and open:
`/versus/team/draft?a=<id1>,<id2>,<id3>&b=<id4>,<id5>`
Confirm: both sides resolve into the clash (captain-named crests, the deck/duel, head-to-head, verdict), the score/meter reflect the synergy-adjusted split, and **no vote buttons or tally appear**. Try a 3-vs-1 (`b=<id4>`) and confirm it still resolves.

- [ ] **Step 6: Commit**

```bash
git add app/versus/team/draft.tsx app/versus/team/draft.web.tsx
git commit -m "feat(versus): drafted clash route /versus/team/draft (?a&b)"
```

---

## Task 6: Full suite green

**Files:** none (verification task)

- [ ] **Step 1: Run the whole suite**

Run: `yarn test:ci`
Expected: all tests pass (including the two new files).

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit (only if a fix was needed)**

```bash
git add -A
git commit -m "chore(versus): phase 2a suite green"
```

---

## Self-Review Notes (coverage map)

- Spec §"Unified Battle Builder" → routing-by-size (`resolveBattleRoute`, Task 2) and the drafted-battle resolution it points at (Tasks 1, 3, 5).
- Spec §"the engine accepts solo & asymmetric sides" → `useDraftBattle` builds 1–5 sides and reuses `resolveTeamBattle` (synergy 0 for a solo side is already handled by `get_team_synergy`).
- Spec §"A drafted battle hands its two rosters to the clash page via a … handoff (no shareable id)" → implemented as URL params (reload-safe + shareable, an improvement over an in-memory handoff), Tasks 2 & 5.
- Spec §"Failure behavior" → `getDraftRoster`/`getTeamSynergy` degrade to empty; the route shows a loader then resolves, and renders nothing broken if a side is empty (the hook returns null sides → loader persists; a follow-up can add a "couldn't build this battle" empty state).
- **Out of scope (Phase 2b, next plan):** the Battle Builder UI (generalizing `/compare/pick` into two trays + adaptive rails + live synergy preview), the hub "Build a battle" entry + the "make it a team battle" bridge, AI verdicts/caching for drafts, and saved teams. This plan deliberately stops at a drafted clash reachable by URL so the builder can be designed and iterated on its own.
```
