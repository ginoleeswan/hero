# Battle Builder Draft-Rails Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/compare/pick` as a MOBA-style draft — two team rails flanking a filterable character pool — with four build-assist enrichments (filter chips, focal hero, iconic-team presets, random per side).

**Architecture:** Pure state stays in `src/lib/battleBuilderState.ts`; one additive `fill` reducer action exposed as `fillActive`. New presentational components (`RailSide`, `FilterChips`, `PresetRail`) + a `usePresetTeams` query hook. The two screens (`pick.web.tsx` 3-column, `pick.tsx` segmented mobile) are thin views over the unchanged `useBattleBuilder` + `useHeroSearchInfinite`. `focal` and filter state live in the screens.

**Tech Stack:** Expo SDK 56 / React Native, expo-router 4 (`.web.tsx`/`.tsx` pairs), react-query, expo-image, expo-linear-gradient.

## Global Constraints

- yarn only. TypeScript — no `any`, `unknown` for caught errors. Functional components. `StyleSheet.create` for all styles (no inline objects except `StyleSheet.absoluteFill`).
- Fonts: `Flame-Regular` display, `Nunito_*` UI. **Never `Flame-Bold`.**
- Colors: navy stage (`COLORS.deepNavy` + `SURFACE_GRADIENT.stageImmersive` web / `['#1c2f5a','#13203a','#0c1526']` LinearGradient native), `COLORS.beige` sheet, `FACTION_A='#9A3E38'` / `FACTION_B='#3E6E73'`, gold `COLORS.goldAccent` for active ring + FIGHT CTA. Top section matches `/versus` (gold eyebrow + `Flame-Regular` title).
- Screens never import `supabase`; all DB via `src/lib/db/*`. Readers degrade to `[]`/null; every enrichment degrades to hidden, never blocks the builder.
- Right-hand side mirrors its captain + slot portraits (`scaleX:-1`) to face centre.
- `addToActive`/`fillActive`/preset/random are **add-only** and no-op on dupes or a full (5) side; removal only via a slot. CTA enabled only when both sides ≥1; navigates `resolveBattleRoute`.
- Reuse, don't re-fetch: `useBattleBuilder`, `useHeroSearchInfinite`, `OpponentCard`, `HeroPeek`, `VsBadge`, `getFeaturedTeams`/`getTeamRoster`, `resolveBattleRoute`. Random fills up to **3** unplaced heroes by default; presets/random target the **active** side.
- `yarn test:ci`, `yarn tsc --noEmit`, and `yarn eslint <changed>` all green per task.

---

### Task 1: `fillActive` — bulk add through the guards

**Files:**
- Modify: `src/lib/battleBuilderState.ts`
- Modify: `src/hooks/useBattleBuilder.ts`
- Test: `__tests__/lib/battleBuilderState.test.ts`

**Interfaces:**
- Consumes: `addToSide(side, other, hero)`, `PickedHero`, `MAX_SIDE` (existing).
- Produces: `fillSide(side: PickedHero[], other: PickedHero[], heroes: PickedHero[]): PickedHero[]` (pure, folds `addToSide`); `BattleBuilder.fillActive(heroes: PickedHero[]): void`.

- [ ] **Step 1: Write the failing test** in `__tests__/lib/battleBuilderState.test.ts`:

```ts
import { fillSide, MAX_SIDE, type PickedHero } from '../../src/lib/battleBuilderState';

const h = (id: string, publisher = 'Marvel'): PickedHero => ({ id, name: id, publisher });

describe('fillSide', () => {
  it('appends all when room and no dupes', () => {
    expect(fillSide([h('a')], [], [h('b'), h('c')]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('skips heroes already on this or the other side', () => {
    expect(fillSide([h('a')], [h('z')], [h('a'), h('z'), h('b')]).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('stops at the cap, preserving order', () => {
    const incoming = Array.from({ length: 9 }, (_, i) => h(`n${i}`));
    expect(fillSide([], [], incoming)).toHaveLength(MAX_SIDE);
  });
  it('returns the same reference when nothing is added', () => {
    const side = [h('a')];
    expect(fillSide(side, [], [h('a')])).toBe(side);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `yarn test:ci __tests__/lib/battleBuilderState.test.ts`
Expected: FAIL — `fillSide` not exported.

- [ ] **Step 3: Implement** in `src/lib/battleBuilderState.ts` (after `addToSide`):

```ts
/** Append many heroes to a side through addToSide's guards (cap, cross-side
 *  dedupe). Returns the same reference when nothing is added. */
export function fillSide(side: PickedHero[], other: PickedHero[], heroes: PickedHero[]): PickedHero[] {
  let next = side;
  for (const hero of heroes) next = addToSide(next, other, hero);
  return next;
}
```

Then wire the hook in `src/hooks/useBattleBuilder.ts`:
- Add to the `Action` union: `| { type: 'fill'; heroes: PickedHero[] }`.
- Add the reducer case (mirrors `add`, active-aware), importing `fillSide`:

```ts
case 'fill':
  return s.active === 'A'
    ? { ...s, aHeroes: fillSide(s.aHeroes, s.bHeroes, a.heroes) }
    : { ...s, bHeroes: fillSide(s.bHeroes, s.aHeroes, a.heroes) };
```

- Add `fillActive: (heroes: PickedHero[]) => void;` to the `BattleBuilder` interface, and in the return:
  `fillActive: useCallback((heroes: PickedHero[]) => dispatch({ type: 'fill', heroes }), []),`

- [ ] **Step 4: Run tests** — `yarn test:ci __tests__/lib/battleBuilderState.test.ts` → PASS. Then `yarn tsc --noEmit` → clean.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(versus): fillActive — bulk add to the active side through the guards"`

---

### Task 2: `usePresetTeams` hook

**Files:**
- Create: `src/hooks/usePresetTeams.ts`
- Test: `__tests__/hooks/usePresetTeams.test.ts`

**Interfaces:**
- Consumes: `getFeaturedTeams(): Promise<FeaturedTeam[]>` from `src/lib/db/teams`; `FeaturedTeam = { id; name; publisher: string|null; logo_url: string|null; popularity: number }`.
- Produces: `usePresetTeams(): { teams: FeaturedTeam[]; loading: boolean }`.

- [ ] **Step 1: Write the failing test** — mock `../../src/lib/db/teams` so `getFeaturedTeams` resolves a 2-team array (use a `mock`-prefixed factory var per repo jest convention), render the hook with a react-query `QueryClientProvider` wrapper, assert `teams` length 2. Mirror an existing hook test in `__tests__/hooks/`.

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement:**

```ts
import { useQuery } from '@tanstack/react-query';
import { getFeaturedTeams, type FeaturedTeam } from '../lib/db/teams';

/** Featured teams for the builder's iconic-team presets. Degrades to []. */
export function usePresetTeams(): { teams: FeaturedTeam[]; loading: boolean } {
  const q = useQuery({
    queryKey: ['presetTeams'],
    staleTime: 1000 * 60 * 30,
    queryFn: getFeaturedTeams,
  });
  return { teams: q.data ?? [], loading: q.isPending };
}
```

- [ ] **Step 4: Run** test → PASS; `yarn tsc --noEmit` → clean.
- [ ] **Step 5: Commit** — `feat(versus): usePresetTeams hook (featured teams for presets)`

---

### Task 3: `FilterChips` component

**Files:**
- Create: `src/components/versus/FilterChips.tsx`

**Interfaces:**
- Consumes: `PublisherFilter = 'All'|'Marvel'|'DC'|'Other'`, `AlignmentFilter = 'All'|'Heroes'|'Villains'|'Anti'` from `src/lib/db/heroes/types`.
- Produces: `FilterChips` — props `{ publisher: PublisherFilter; alignment: AlignmentFilter; onPublisher: (p: PublisherFilter) => void; onAlignment: (a: AlignmentFilter) => void }`.

- [ ] **Step 1: Implement** a presentational two-group chip bar. Publisher group: `All · Marvel · DC` (omit `Other` to keep it tight — `Other` reachable later). Alignment group: `All · Heroes · Villains`. Each chip a `Pressable` with `Nunito_700Bold` ~12px; selected = filled gold (`COLORS.goldAccent`, dark text), unselected = hairline outline on the current surface (works on the beige sheet). Groups wrap on a horizontal `ScrollView` for native. `StyleSheet.create`; no `any`.
- [ ] **Step 2: Verify** — `yarn tsc --noEmit` clean; `yarn eslint src/components/versus/FilterChips.tsx` clean.
- [ ] **Step 3: Commit** — `feat(versus): FilterChips — publisher + alignment chip bar`

---

### Task 4: `PresetRail` component

**Files:**
- Create: `src/components/versus/PresetRail.tsx`

**Interfaces:**
- Consumes: `FeaturedTeam` from `src/lib/db/teams`.
- Produces: `PresetRail` — props `{ teams: FeaturedTeam[]; onPick: (teamId: string) => void; tint: string }`. Returns `null` when `teams` is empty.

- [ ] **Step 1: Implement** a labeled horizontal `ScrollView` ("⚡ Quick teams → Side X" via a `label` prop, or hardcode "Quick teams"). Each team a `Pressable` pill showing `logo_url` (expo-image, small round) + `name` (`Nunito_700Bold` ~11px, `numberOfLines={1}`); fallback to a tinted monogram when no logo. `tint` colors the pill border. Hidden (`null`) when no teams. Add a `label` prop `string` for the side caption. `StyleSheet.create`.
- [ ] **Step 2: Verify** — tsc + eslint clean.
- [ ] **Step 3: Commit** — `feat(versus): PresetRail — one-tap iconic-team fills`

---

### Task 5: `RailSide` component (vertical team rail)

**Files:**
- Create: `src/components/versus/RailSide.tsx`

**Interfaces:**
- Consumes: `FighterAnchor` (`{ fighter, seatLabel, active, flip, w, h, onPress, onClear }`, `ANCHOR_W/H`) from `src/components/compare/FighterAnchor`; `MAX_SIDE`, `PickedHero` from `src/lib/battleBuilderState`; expo-image `Image`.
- Produces: `RailSide` — props `{ label: string; tint: string; roster: PickedHero[]; synergy: number; publisher: 'marvel'|'dc'|null; active: boolean; flip?: boolean; captainW?: number; captainH?: number; slot?: number; onActivate: () => void; onRemove: (id: string) => void; onRandom?: () => void }`.

- [ ] **Step 1: Implement** a **vertical** column (this is `BuilderSide` rotated): the captain (`roster[0]`) in a `FighterAnchor` on top (`captainW`/`captainH`, `flip`, `active`, `onPress={onActivate}`, `onClear` removes the captain), then the 5 fixed slots **stacked vertically** beneath (filled = portrait + `×` remove badge, `flip` mirrors the portrait; empty = dashed `+`), then the side `label`, the synergy % (`roster.length >= 2`), the publisher badge, and — when `onRandom` — a small dice `Pressable` ("🎲 Random"). The whole column shows the gold active ring when `active`. Reuse `BuilderSide`'s slot/meta styling (lift the shared bits; you may delete `BuilderSide` if Task 6/7 no longer import it — verify before deleting). `StyleSheet.create`.
- [ ] **Step 2: Verify** — tsc + eslint clean.
- [ ] **Step 3: Commit** — `feat(versus): RailSide — vertical team rail (captain + stacked slots + dice)`

---

### Task 6: Rewrite `pick.web.tsx` — 3-column draft

**Files:**
- Modify (rewrite): `app/compare/pick.web.tsx`

**Interfaces:**
- Consumes: `useBattleBuilder` (now with `fillActive`), `RailSide`, `FilterChips`, `PresetRail`, `usePresetTeams`, `useHeroSearchInfinite(q, publisher, alignment)`, `OpponentCard` (`item`, `onPress`, `width`, `height`), `VsBadge`, `getTeamRoster`, `resolveBattleRoute` (via `battleHref`), `withViewTransition`, `useScreenChrome`, `TOPBAR_HEIGHT`, `SURFACE_GRADIENT`, `FACTION_A/B`, `COLORS/SURFACE`, `PickedHero`, `PublisherFilter`/`AlignmentFilter`.

- [ ] **Step 1: Implement** the three-column layout (keep the `useDebounce` (`useEffect`) helper and `useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper })`):
  - **Screen state:** `publisher`/`alignment` (default `'All'`), `query`, `focal: PickedHero | null`.
  - `useHeroSearchInfinite(debouncedQuery, publisher, alignment)`; `heroes` = pages flat, filtered `!b.isPlaced`, sliced 120 (keep the `eslint-disable-next-line react-hooks/exhaustive-deps` granular-deps memo).
  - `const { teams } = usePresetTeams();`
  - **`add(hero)`** = `b.addToActive(hero); setFocal(hero);`
  - **`pickPreset(teamId)`** = `const roster = await getTeamRoster(teamId, 5); b.fillActive(roster as PickedHero[]); setFocal(roster[0] ?? null);` (wrap in an async handler; `RosterHero` is assignable to `PickedHero`).
  - **`random(side)`** = make that side active, then `b.fillActive(pickRandom(heroes, 3))` where `pickRandom` takes up to N not-yet-placed heroes (shuffle a copy). Define `pickRandom` inline (pure, no test needed).
  - **Layout:** a top navy stage (`stageImmersive`, `paddingTop: TOPBAR_HEIGHT + 26`) holding the eyebrow `★ Build a Battle ★` + title `Assemble Your Sides` + the focal stage (`focal ?? captain` enlarged portrait via an `OpponentCard`-like or a plain `Image`, with `VsBadge size={48}` beside) — keep it centered. Then a 3-column row: `RailSide A` (left, `onRandom`), the centre column (`FilterChips` → `PresetRail label="→ active side"` → search input → the grid as a flex-wrap of `OpponentCard` with `onPress={() => add(item)}`), `RailSide B` (right, `flip`, `onRandom`). Rails ~168px; centre flexes; `maxWidth` ~1180 centered.
  - **FIGHT CTA** below the columns, centered, gold, `BATTLE · {a} vs {b} →` gated on `b.canBattle && b.battleHref`, routing `withViewTransition(() => router.push(b.battleHref as Parameters<typeof router.push>[0]))`; else the `Tap heroes…` hint.
  - **Empty filtered grid:** if `heroes.length === 0 && !searchQ.isPending`, show a muted "No fighters match these filters" line.
  - Below ~768px (`width < 768`), render rails stacked above the grid (a simple fallback — full segmented UX is the native screen; on narrow web just stack `RailSide A`/`RailSide B` horizontally over the centre column). Keep it functional, not pixel-perfect.
- [ ] **Step 2: Verify** — `yarn tsc --noEmit` clean; `yarn eslint app/compare/pick.web.tsx` clean (0 errors). Do NOT start a web server.
- [ ] **Step 3: Commit** — `feat(versus): web Battle Builder draft-rails (3-column + filters + presets)`

---

### Task 7: Rewrite `pick.tsx` — segmented mobile

**Files:**
- Modify (rewrite): `app/compare/pick.tsx`

**Interfaces:** same as Task 6 minus web-only bits; native uses `FlatList`, `LinearGradient`, `HeroPeek`, `expo-haptics`, `useSafeAreaInsets`.

- [ ] **Step 1: Implement:**
  - Same screen state (`publisher`/`alignment`/`query`/`focal`), same `add`/`pickPreset`/`random`/`pickRandom`, same `heroes` memo.
  - **Header (FlatList `ListHeaderComponent`):** the `LinearGradient` navy stage (eyebrow + title), a **segmented `Side A | Side B` toggle** (two `Pressable` segments showing `Side X · N` + synergy; active = gold ring; tap switches `b.setActive`), the **active side's compact slot row** (reuse `RailSide` horizontal-ish or a small inline row — show the active side's 5 slots + a 🎲 dice + the captain), and a small `VS` marker. Below the stage on the beige `sheetTop`: `FilterChips` → `PresetRail` → search → (`TeammatesRail` of the active captain stays, optional). 
  - **Grid:** `FlatList` `numColumns={3}`, `OpponentCard` `onPress={() => add(item)}` `onLongPress={() => setPeek(item)}`, infinite `onEndReached` → `fetchNextPage`.
  - **Sticky gold FIGHT bar** (absolute bottom), gated on `b.canBattle`, routes `router.push(b.battleHref …)`.
  - `HeroPeek` on long-press with `onFight={() => { add(peek); setPeek(null); }}`, `onViewProfile`, `onClose`.
  - Keep `StatusBar style="light"`, `Stack.Screen headerShown:false`.
- [ ] **Step 2: Verify** — `yarn tsc --noEmit` clean; `yarn eslint app/compare/pick.tsx` clean.
- [ ] **Step 3: Commit** — `feat(versus): native Battle Builder draft (segmented sides + filters + presets)`

---

### Task 8: Whole-feature verification

**Files:** none (gate only).

- [ ] **Step 1** — `yarn tsc --noEmit` → clean.
- [ ] **Step 2** — `yarn test:ci` → all suites pass (≥ 429: prior 425 + `fillSide` + `usePresetTeams`).
- [ ] **Step 3** — `yarn eslint app/compare/pick.tsx app/compare/pick.web.tsx src/components/versus/RailSide.tsx src/components/versus/FilterChips.tsx src/components/versus/PresetRail.tsx src/hooks/usePresetTeams.ts` → 0 errors (warnings only if pre-existing pattern).
- [ ] **Step 4** — confirm no screen imports `supabase` directly; confirm `RailSide` right side mirrors; confirm a deleted `BuilderSide` (if removed) has no remaining importers (`grep -rn BuilderSide src app`).
- [ ] **Step 5: Commit** any lint cleanup — `chore(versus): draft-rails verification pass`.
