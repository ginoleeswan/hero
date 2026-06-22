# Battle Builder — Phase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1v1 picker at `/compare/pick` with one unified Battle Builder that assembles two sides of 1–5 heroes (asymmetric allowed) and, on Battle, routes by size through the existing `resolveBattleRoute` (1×1 → the `/compare` arena; larger → the drafted clash).

**Architecture:** A pure state module (`battleBuilderState.ts`) holds the placement rules; a platform-neutral `useBattleBuilder` hook wraps it in a reducer and adds react-query for live synergy + the captain's teammates; two thin screens (`pick.tsx` native, `pick.web.tsx` web) render it, reusing the existing `OpponentCard`/`HeroPeek`/search and navy/beige chrome. The builder produces only a route — all resolution/rendering downstream is Phase 2a.

**Tech Stack:** TypeScript, Expo Router 4, React Native / web, react-query, jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-23-battle-builder-phase2b-design.md`

## Global Constraints

- yarn only. Tests: `yarn test:ci`. TypeScript — no `any`; `unknown` for caught errors.
- Screens never import `supabase` directly — all DB access via `src/lib/db/`. Readers degrade gracefully (return `[]`, never throw).
- Sides are **1–5 heroes**; a hero may be on at most one side. The Battle CTA is enabled only when **both sides have ≥1**.
- Add-to-side via an **active-side toggle**; grid/rail taps are **add-only**; removal is by tapping a **filled slot** in the tray.
- Reuse existing code, do not reimplement: `resolveBattleRoute(aIds, bIds)` from `src/lib/battleRoute.ts`; `getTeamSynergy(ids)` from `src/lib/db/teams.ts`; `getRelatedHeroes(heroId, 'teammate')` from `src/lib/db/heroes` (returns `RelatedHeroCard[]`); `useHeroSearchInfinite(query, publisher, alignment)` from `src/lib/query/heroQueries.ts`; `OpponentCard` (props: `item: {id,name,image_url?,portrait_url?}`, `onPress`, `width?`, `height?`) and `HeroPeek` from `src/components/compare/`.
- Faction tints from `src/components/versus/factionColors.ts` (`FACTION_A` #9A3E38 / `FACTION_B` #3E6E73); gold `COLORS.goldAccent`; navy stage `COLORS.navy`→`COLORS.deepNavy`; beige sheet `COLORS.beige`. Fonts: `Flame-Regular` display, `Nunito_*` UI; never `Flame-Bold`. Styles via `StyleSheet.create`.
- Platform pair `pick.tsx`/`pick.web.tsx`: both must exist; shared state/fetch lives in `useBattleBuilder`, never duplicated.
- `getTeamSynergy` returns `{ total_pct, ... }` with `total_pct` in 0..1 (use `Math.round(total_pct * 100)` for the %); a side of <2 yields 0.

---

## File Structure

**Source (new):**
- `src/lib/battleBuilderState.ts` — pure placement rules (`PickedHero`, `addToSide`, `removeFromSide`, `canBattle`, `derivePublisher`, `MAX_SIDE`)
- `src/hooks/useBattleBuilder.ts` — reducer + react-query (synergy, teammates) + `battleHref`
- `src/components/versus/RosterTray.tsx` — one side's tray (5 slots, synergy %, publisher badge)
- `src/components/versus/TeammatesRail.tsx` — the captain's teammates rail

**Source (rewrite):**
- `app/compare/pick.tsx` — native builder view
- `app/compare/pick.web.tsx` — web builder view

**Source (remove, superseded):**
- `app/compare/[hero]/pick.tsx`, `app/compare/[hero]/pick.web.tsx`, and `src/hooks/usePickOpponents.ts` (only if no other consumer remains — verify)

**Tests (new):**
- `__tests__/lib/battleBuilderState.test.ts`

---

## Task 1: Pure placement rules — `battleBuilderState.ts`

**Files:**
- Create: `src/lib/battleBuilderState.ts`
- Test: `__tests__/lib/battleBuilderState.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PickedHero { id: string; name: string; portrait_url?: string | null; image_url?: string | null; publisher?: string | null; }
  export type Side = 'A' | 'B';
  export const MAX_SIDE = 5;
  export function addToSide(side: PickedHero[], other: PickedHero[], hero: PickedHero): PickedHero[];
  export function removeFromSide(side: PickedHero[], id: string): PickedHero[];
  export function canBattle(a: PickedHero[], b: PickedHero[]): boolean;
  export function derivePublisher(heroes: PickedHero[]): 'marvel' | 'dc' | null;
  ```

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/battleBuilderState.test.ts`:

```ts
import { addToSide, removeFromSide, canBattle, derivePublisher, MAX_SIDE, type PickedHero } from '../../src/lib/battleBuilderState';

const h = (id: string, publisher: string | null = 'Marvel Comics'): PickedHero => ({ id, name: id, publisher });

describe('addToSide', () => {
  it('appends a hero to the side', () => {
    expect(addToSide([h('a')], [], h('b')).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('is a no-op when the side is full (5)', () => {
    const full = ['1', '2', '3', '4', '5'].map((i) => h(i));
    expect(addToSide(full, [], h('6'))).toBe(full); // unchanged reference
  });
  it('is a no-op when the hero is already on this side', () => {
    const side = [h('a')];
    expect(addToSide(side, [], h('a'))).toBe(side);
  });
  it('is a no-op when the hero is already on the other side', () => {
    const side = [h('a')];
    expect(addToSide(side, [h('x')], h('x'))).toBe(side);
  });
});

describe('removeFromSide', () => {
  it('removes the hero by id', () => {
    expect(removeFromSide([h('a'), h('b')], 'a').map((x) => x.id)).toEqual(['b']);
  });
});

describe('canBattle', () => {
  it('is false until both sides have at least one', () => {
    expect(canBattle([], [h('b')])).toBe(false);
    expect(canBattle([h('a')], [])).toBe(false);
    expect(canBattle([h('a')], [h('b')])).toBe(true);
  });
});

describe('derivePublisher', () => {
  it('returns null for fewer than two heroes', () => {
    expect(derivePublisher([h('a', 'DC Comics')])).toBeNull();
  });
  it('returns the shared publisher when all match', () => {
    expect(derivePublisher([h('a', 'DC Comics'), h('b', 'DC Entertainment')])).toBe('dc');
    expect(derivePublisher([h('a', 'Marvel Comics'), h('b', 'Marvel')])).toBe('marvel');
  });
  it('returns null for a mixed roster', () => {
    expect(derivePublisher([h('a', 'DC Comics'), h('b', 'Marvel Comics')])).toBeNull();
  });
  it('returns null when the shared publisher is neither Marvel nor DC', () => {
    expect(derivePublisher([h('a', 'Image'), h('b', 'Image')])).toBeNull();
  });

  it('MAX_SIDE is 5', () => {
    expect(MAX_SIDE).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:ci __tests__/lib/battleBuilderState.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

Create `src/lib/battleBuilderState.ts`:

```ts
/** A lightweight hero as held by the builder — the fields the trays/synergy/route
 *  need, captured from the grid/rail item on tap (no extra fetch). */
export interface PickedHero {
  id: string;
  name: string;
  portrait_url?: string | null;
  image_url?: string | null;
  publisher?: string | null;
}

export type Side = 'A' | 'B';
export const MAX_SIDE = 5;

/** Append to a side unless it is full or the hero already sits on either side.
 *  Returns the same array reference when unchanged (cheap no-op for React). */
export function addToSide(side: PickedHero[], other: PickedHero[], hero: PickedHero): PickedHero[] {
  if (side.length >= MAX_SIDE) return side;
  if (side.some((h) => h.id === hero.id) || other.some((h) => h.id === hero.id)) return side;
  return [...side, hero];
}

export function removeFromSide(side: PickedHero[], id: string): PickedHero[] {
  return side.filter((h) => h.id !== id);
}

export function canBattle(a: PickedHero[], b: PickedHero[]): boolean {
  return a.length >= 1 && b.length >= 1;
}

function pubKey(p?: string | null): 'marvel' | 'dc' | 'other' {
  const s = (p ?? '').toLowerCase();
  if (s.includes('marvel')) return 'marvel';
  if (s.includes('dc')) return 'dc';
  return 'other';
}

/** 'marvel' | 'dc' only when the roster has ≥2 heroes that all share that
 *  publisher; otherwise null (mixed, non-major, or too few to be notable). */
export function derivePublisher(heroes: PickedHero[]): 'marvel' | 'dc' | null {
  if (heroes.length < 2) return null;
  const keys = heroes.map((h) => pubKey(h.publisher));
  const first = keys[0];
  if (first === 'other') return null;
  return keys.every((k) => k === first) ? first : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:ci __tests__/lib/battleBuilderState.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battleBuilderState.ts __tests__/lib/battleBuilderState.test.ts
git commit -m "feat(versus): pure battle-builder placement rules + tests"
```

---

## Task 2: `useBattleBuilder` hook

**Files:**
- Create: `src/hooks/useBattleBuilder.ts`

**Interfaces:**
- Consumes: `addToSide`/`removeFromSide`/`canBattle`/`derivePublisher`/`PickedHero`/`Side`/`MAX_SIDE` from `../lib/battleBuilderState`; `getTeamSynergy` from `../lib/db/teams`; `getRelatedHeroes` from `../lib/db/heroes`; `resolveBattleRoute` from `../lib/battleRoute`; `useReducer`/`useMemo`/`useCallback` + `useQuery`.
- Produces:
  ```ts
  export interface BattleBuilder {
    aHeroes: PickedHero[]; bHeroes: PickedHero[]; active: Side;
    setActive: (side: Side) => void;
    addToActive: (hero: PickedHero) => void;
    removeHero: (id: string) => void;
    synergyA: number; synergyB: number;          // 0–100
    publisherA: 'marvel' | 'dc' | null; publisherB: 'marvel' | 'dc' | null;
    teammates: { id: string; name: string; image_url?: string | null; portrait_url?: string | null }[];
    isPlaced: (id: string) => boolean;
    canBattle: boolean;
    battleHref: string | null;
  }
  export function useBattleBuilder(): BattleBuilder;
  ```

- [ ] **Step 1: Write the hook**

Create `src/hooks/useBattleBuilder.ts`:

```ts
import { useCallback, useMemo, useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addToSide,
  removeFromSide,
  canBattle as canBattleFn,
  derivePublisher,
  type PickedHero,
  type Side,
} from '../lib/battleBuilderState';
import { getTeamSynergy } from '../lib/db/teams';
import { getRelatedHeroes } from '../lib/db/heroes';
import { resolveBattleRoute } from '../lib/battleRoute';

export interface BattleBuilder {
  aHeroes: PickedHero[];
  bHeroes: PickedHero[];
  active: Side;
  setActive: (side: Side) => void;
  addToActive: (hero: PickedHero) => void;
  removeHero: (id: string) => void;
  synergyA: number;
  synergyB: number;
  publisherA: 'marvel' | 'dc' | null;
  publisherB: 'marvel' | 'dc' | null;
  teammates: { id: string; name: string; image_url?: string | null; portrait_url?: string | null }[];
  isPlaced: (id: string) => boolean;
  canBattle: boolean;
  battleHref: string | null;
}

interface State { aHeroes: PickedHero[]; bHeroes: PickedHero[]; active: Side; }
type Action =
  | { type: 'add'; hero: PickedHero }
  | { type: 'remove'; id: string }
  | { type: 'active'; side: Side };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'add':
      return s.active === 'A'
        ? { ...s, aHeroes: addToSide(s.aHeroes, s.bHeroes, a.hero) }
        : { ...s, bHeroes: addToSide(s.bHeroes, s.aHeroes, a.hero) };
    case 'remove':
      return { ...s, aHeroes: removeFromSide(s.aHeroes, a.id), bHeroes: removeFromSide(s.bHeroes, a.id) };
    case 'active':
      return { ...s, active: a.side };
  }
}

function useSynergy(ids: string[]): number {
  const key = ids.join(',');
  const q = useQuery({
    queryKey: ['builderSynergy', key],
    enabled: ids.length >= 2,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => Math.round((await getTeamSynergy(ids)).total_pct * 100),
  });
  return ids.length >= 2 ? (q.data ?? 0) : 0;
}

export function useBattleBuilder(): BattleBuilder {
  const [state, dispatch] = useReducer(reducer, { aHeroes: [], bHeroes: [], active: 'A' });
  const { aHeroes, bHeroes, active } = state;

  const aIds = useMemo(() => aHeroes.map((h) => h.id), [aHeroes]);
  const bIds = useMemo(() => bHeroes.map((h) => h.id), [bHeroes]);

  const synergyA = useSynergy(aIds);
  const synergyB = useSynergy(bIds);

  // Teammates of the active side's captain (its first hero), minus anyone placed.
  const captainId = (active === 'A' ? aHeroes : bHeroes)[0]?.id;
  const placedIds = useMemo(() => new Set([...aIds, ...bIds]), [aIds, bIds]);
  const teammatesQ = useQuery({
    queryKey: ['builderTeammates', captainId ?? ''],
    enabled: !!captainId,
    staleTime: 1000 * 60 * 30,
    queryFn: () => getRelatedHeroes(captainId as string, 'teammate', { limit: 20 }),
  });
  const teammates = useMemo(
    () => (teammatesQ.data ?? []).filter((t) => !placedIds.has(t.id)),
    [teammatesQ.data, placedIds],
  );

  const isPlaced = useCallback((id: string) => placedIds.has(id), [placedIds]);

  return {
    aHeroes,
    bHeroes,
    active,
    setActive: useCallback((side: Side) => dispatch({ type: 'active', side }), []),
    addToActive: useCallback((hero: PickedHero) => dispatch({ type: 'add', hero }), []),
    removeHero: useCallback((id: string) => dispatch({ type: 'remove', id }), []),
    synergyA,
    synergyB,
    publisherA: derivePublisher(aHeroes),
    publisherB: derivePublisher(bHeroes),
    teammates,
    isPlaced,
    canBattle: canBattleFn(aHeroes, bHeroes),
    battleHref: useMemo(() => resolveBattleRoute(aIds, bIds), [aIds, bIds]),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0. (Confirms `getTeamSynergy`'s `total_pct`, `getRelatedHeroes`'s `(heroId, kind, opts)` signature + `RelatedHeroCard` fields, and `resolveBattleRoute` all line up.)

- [ ] **Step 3: If tsc flags a mismatch**, check the real exports in `src/lib/db/teams.ts`, `src/lib/db/heroes` (the `getRelatedHeroes` re-export), and `src/lib/battleRoute.ts`; reconcile to the real names. Do not invent exports.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useBattleBuilder.ts
git commit -m "feat(versus): useBattleBuilder hook (state + live synergy + teammates)"
```

---

## Task 3: `RosterTray` component

**Files:**
- Create: `src/components/versus/RosterTray.tsx`

**Interfaces:**
- Consumes: `PickedHero`, `MAX_SIDE` from `../../lib/battleBuilderState`; `COLORS` from `../../constants/colors`; `expo-image`.
- Produces:
  ```ts
  export function RosterTray(props: {
    label: string;                 // "Side A"
    tint: string;                  // faction tint
    roster: PickedHero[];
    synergy: number;               // 0–100
    publisher: 'marvel' | 'dc' | null;
    active: boolean;
    onActivate: () => void;
    onRemove: (id: string) => void;
    slot?: number;                 // slot px width (default 40)
  }): JSX.Element;
  ```

- [ ] **Step 1: Implement**

Create `src/components/versus/RosterTray.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { MAX_SIDE, type PickedHero } from '../../lib/battleBuilderState';

interface Props {
  label: string;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  onActivate: () => void;
  onRemove: (id: string) => void;
  slot?: number;
}

export function RosterTray({ label, tint, roster, synergy, publisher, active, onActivate, onRemove, slot = 40 }: Props) {
  const captain = roster[0];
  return (
    <Pressable onPress={onActivate} style={[styles.tray, active ? styles.active : null]}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {active ? '◉ ' : ''}
          {label}
          {captain ? ` · ${captain.name}` : ''}
        </Text>
        <View style={styles.meta}>
          {publisher ? <Text style={styles.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text> : null}
          {roster.length >= 2 ? <Text style={[styles.syn, { color: tint }]}>SYN +{synergy}%</Text> : null}
        </View>
      </View>
      <View style={styles.slots}>
        {Array.from({ length: MAX_SIDE }).map((_, i) => {
          const hero = roster[i];
          const size = { width: slot, height: Math.round((slot * 9) / 7) };
          if (!hero) {
            return <View key={i} style={[styles.empty, size]}><Text style={styles.plus}>+</Text></View>;
          }
          const uri = hero.portrait_url ?? hero.image_url ?? undefined;
          return (
            <Pressable key={hero.id} onPress={() => onRemove(hero.id)} style={[styles.slot, size]}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: tint }]} />
              )}
              <View style={styles.removeBadge}>
                <Text style={styles.removeX}>×</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tray: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, gap: 8 },
  active: { backgroundColor: 'rgba(206,155,51,0.10)', borderWidth: 1.5, borderColor: COLORS.goldAccent },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, letterSpacing: 0.3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pub: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: COLORS.goldAccent, borderWidth: 1, borderColor: 'rgba(206,155,51,0.5)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 10 },
  slots: { flexDirection: 'row', gap: 6 },
  slot: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1b2a30' },
  fallback: {},
  empty: { borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  removeBadge: { position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(11,24,32,0.8)', alignItems: 'center', justifyContent: 'center' },
  removeX: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff', lineHeight: 13 },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
yarn tsc --noEmit
git add src/components/versus/RosterTray.tsx
git commit -m "feat(versus): RosterTray — a side's 5 slots + synergy + publisher badge"
```

---

## Task 4: `TeammatesRail` component

**Files:**
- Create: `src/components/versus/TeammatesRail.tsx`

**Interfaces:**
- Consumes: `OpponentCard` from `../compare/OpponentCard`; `COLORS`.
- Produces:
  ```ts
  export function TeammatesRail(props: {
    captainName: string;
    sideLabel: string;            // "Side A"
    tint: string;
    items: { id: string; name: string; image_url?: string | null; portrait_url?: string | null }[];
    onAdd: (item: { id: string; name: string; image_url?: string | null; portrait_url?: string | null }) => void;
  }): JSX.Element | null;          // null when items is empty
  ```

- [ ] **Step 1: Implement**

Create `src/components/versus/TeammatesRail.tsx`:

```tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { OpponentCard } from '../compare/OpponentCard';

interface Item { id: string; name: string; image_url?: string | null; portrait_url?: string | null; }

interface Props {
  captainName: string;
  sideLabel: string;
  tint: string;
  items: Item[];
  onAdd: (item: Item) => void;
}

/** Canon teammates of the active side's captain — one tap adds to that side.
 *  Renders nothing when there are no teammates to suggest. */
export function TeammatesRail({ captainName, sideLabel, tint, items, onAdd }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        ★ Teammates of {captainName} → {sideLabel}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((it) => (
          <OpponentCard key={it.id} item={it} onPress={() => onAdd(it)} width={56} height={72} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(154,62,56,0.08)', borderWidth: 1, borderColor: 'rgba(154,62,56,0.25)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  row: { gap: 8 },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
yarn tsc --noEmit
git add src/components/versus/TeammatesRail.tsx
git commit -m "feat(versus): TeammatesRail — captain's teammates as a one-tap rail"
```

---

## Task 5: Native builder screen — rewrite `app/compare/pick.tsx`

**Files:**
- Rewrite: `app/compare/pick.tsx`

**Interfaces:**
- Consumes: `useBattleBuilder`; `RosterTray`; `TeammatesRail`; `useHeroSearchInfinite`; `OpponentCard`; `HeroPeek`; `resolveBattleRoute` (via the hook's `battleHref`); `useRouter` from expo-router.

The screen: a navy header with the two trays **stacked** (`RosterTray` A then B), a beige body with `TeammatesRail` → search field → 3-column grid (`OpponentCard`), and a **sticky gold Battle bar** at the bottom (enabled only when `canBattle`). Tapping a grid/rail hero calls `addToActive`; the trays handle removal. On Battle, `router.push(battleHref)`.

- [ ] **Step 1: Rewrite the screen**

Replace the contents of `app/compare/pick.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { RosterTray } from '../../src/components/versus/RosterTray';
import { TeammatesRail } from '../../src/components/versus/TeammatesRail';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS } from '../../src/constants/colors';
import type { PickedHero } from '../../src/lib/battleBuilderState';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP * 2) / 3;
const CARD_H = Math.round(CARD_W * 1.4);

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function BattleBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const b = useBattleBuilder();
  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const debounced = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, 'All', 'All');
  const heroes = useMemo(() => (searchQ.data?.pages ?? []).flat().slice(0, 120), [searchQ.data]);

  const add = (hero: PickedHero) => {
    Haptics.selectionAsync();
    b.addToActive(hero);
  };
  const activeLabel = b.active === 'A' ? 'Side A' : 'Side B';
  const activeCaptain = (b.active === 'A' ? b.aHeroes : b.bHeroes)[0];

  const header = (
    <>
      <View style={[styles.stage, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Build a Battle</Text>
        <RosterTray
          label="Side A"
          tint={FACTION_A}
          roster={b.aHeroes}
          synergy={b.synergyA}
          publisher={b.publisherA}
          active={b.active === 'A'}
          onActivate={() => b.setActive('A')}
          onRemove={b.removeHero}
        />
        <View style={{ height: 8 }} />
        <RosterTray
          label="Side B"
          tint={FACTION_B}
          roster={b.bHeroes}
          synergy={b.synergyB}
          publisher={b.publisherB}
          active={b.active === 'B'}
          onActivate={() => b.setActive('B')}
          onRemove={b.removeHero}
        />
      </View>

      <View style={styles.sheetTop}>
        {activeCaptain ? (
          <TeammatesRail
            captainName={activeCaptain.name}
            sideLabel={activeLabel}
            tint={b.active === 'A' ? FACTION_A : FACTION_B}
            items={b.teammates}
            onAdd={add}
          />
        ) : null}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color="rgba(41,60,67,0.4)" />
          <TextInput
            style={styles.input}
            placeholder="Search any hero or villain…"
            placeholderTextColor="rgba(41,60,67,0.38)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <FlatList
        data={heroes}
        keyExtractor={(it) => it.id}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        onEndReached={() => {
          if (searchQ.hasNextPage && !searchQ.isFetchingNextPage) searchQ.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <OpponentCard item={item} onPress={() => add(item)} onLongPress={() => setPeek(item)} width={CARD_W} height={CARD_H} />
        )}
      />

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable
          disabled={!b.canBattle || !b.battleHref}
          onPress={() => {
            if (b.battleHref) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(b.battleHref as Parameters<typeof router.push>[0]);
            }
          }}
          style={[styles.cta, !b.canBattle ? styles.ctaDim : null]}
        >
          <Text style={[styles.ctaTxt, !b.canBattle ? styles.ctaTxtDim : null]}>
            {b.canBattle ? `BATTLE · ${b.aHeroes.length} vs ${b.bHeroes.length} →` : 'Add a hero to each side'}
          </Text>
        </Pressable>
      </View>

      {peek ? (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => {
            add(peek);
            setPeek(null);
          }}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: H_PAD, paddingBottom: 16 },
  title: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige, marginBottom: 14 },
  sheetTop: { backgroundColor: COLORS.beige, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -8, paddingTop: 18, paddingHorizontal: H_PAD, gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(41,60,67,0.06)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(41,60,67,0.12)', paddingHorizontal: 14, height: 46, gap: 9 },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },
  gridRow: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: H_PAD, paddingTop: 10, backgroundColor: 'rgba(11,24,32,0.92)' },
  cta: { backgroundColor: COLORS.goldAccent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaDim: { backgroundColor: 'rgba(255,255,255,0.12)' },
  ctaTxt: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#1a130a', letterSpacing: 0.5 },
  ctaTxtDim: { color: 'rgba(245,235,220,0.6)' },
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0. If `HeroPeek`'s `PeekHero` type or `OpponentCard`'s `onLongPress` prop differs, read those files and reconcile (they're existing components — match their real props).

- [ ] **Step 3: Manual verification**

`yarn start`, open the native app, tap the hub's "Build your own" (→ `/compare/pick`). Confirm: two stacked trays (A active by default), tapping a grid hero fills Side A's first slot + synergy/publisher update once a side has ≥2; tapping Side B's header makes it active and subsequent taps fill B; tapping a filled slot removes it; the teammates rail appears once a side has a captain; the Battle bar is disabled until both sides have ≥1, then reads "BATTLE · N vs M →"; tapping it with a 1-v-1 opens `/compare/a/b`, and with larger sides opens the drafted clash.

- [ ] **Step 4: Commit**

```bash
git add app/compare/pick.tsx
git commit -m "feat(versus): native Battle Builder screen (stacked trays + grid + battle bar)"
```

---

## Task 6: Web builder screen — rewrite `app/compare/pick.web.tsx`

**Files:**
- Rewrite: `app/compare/pick.web.tsx`

**Interfaces:** same as Task 5, web chrome via `useScreenChrome` + `SURFACE` + `TOPBAR_HEIGHT`.

The screen: a navy top band with the two trays **side-by-side** (Side A · a gold "VS" · Side B), a beige sheet with `TeammatesRail` → search → a wider hero grid → a centered Battle CTA. Same `useBattleBuilder` wiring; on Battle, navigate to `battleHref` (use `withViewTransition` like the current `pick.web.tsx` does).

- [ ] **Step 1: Rewrite the screen**

Replace the contents of `app/compare/pick.web.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { RosterTray } from '../../src/components/versus/RosterTray';
import { TeammatesRail } from '../../src/components/versus/TeammatesRail';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { withViewTransition } from '../../src/lib/viewTransition';
import type { PickedHero } from '../../src/lib/battleBuilderState';

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function BattleBuilderWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 6 : width >= 700 ? 5 : 3;
  const b = useBattleBuilder();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debounced, 'All', 'All');
  const heroes = useMemo(() => (searchQ.data?.pages ?? []).flat().slice(0, 120), [searchQ.data]);

  const add = (hero: PickedHero) => b.addToActive(hero);
  const activeCaptain = (b.active === 'A' ? b.aHeroes : b.bHeroes)[0];
  const cardW = Math.floor((Math.min(width, 1100) - 64 - (cols - 1) * 12) / cols);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: TOPBAR_HEIGHT + 20 }]}>
      <View style={styles.band}>
        <View style={styles.trays}>
          <View style={styles.trayCell}>
            <RosterTray label="Side A" tint={FACTION_A} roster={b.aHeroes} synergy={b.synergyA} publisher={b.publisherA} active={b.active === 'A'} onActivate={() => b.setActive('A')} onRemove={b.removeHero} slot={46} />
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.trayCell}>
            <RosterTray label="Side B" tint={FACTION_B} roster={b.bHeroes} synergy={b.synergyB} publisher={b.publisherB} active={b.active === 'B'} onActivate={() => b.setActive('B')} onRemove={b.removeHero} slot={46} />
          </View>
        </View>
      </View>

      <View style={styles.sheet}>
        {activeCaptain ? (
          <TeammatesRail captainName={activeCaptain.name} sideLabel={b.active === 'A' ? 'Side A' : 'Side B'} tint={b.active === 'A' ? FACTION_A : FACTION_B} items={b.teammates} onAdd={add} />
        ) : null}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color="rgba(41,60,67,0.4)" />
          <TextInput style={styles.input} placeholder="Search any hero or villain…" placeholderTextColor="rgba(41,60,67,0.38)" value={query} onChangeText={setQuery} />
        </View>
        <View style={styles.grid}>
          {heroes.map((item) => (
            <OpponentCard key={item.id} item={item} onPress={() => add(item)} width={cardW} height={Math.round(cardW * 1.4)} />
          ))}
        </View>
        <View style={styles.ctaWrap}>
          <Pressable
            disabled={!b.canBattle || !b.battleHref}
            onPress={() => {
              if (b.battleHref) withViewTransition(() => router.push(b.battleHref as Parameters<typeof router.push>[0]));
            }}
            style={[styles.cta, !b.canBattle ? styles.ctaDim : null]}
          >
            <Text style={[styles.ctaTxt, !b.canBattle ? styles.ctaTxtDim : null]}>
              {b.canBattle ? `BATTLE · ${b.aHeroes.length} vs ${b.bHeroes.length} →` : 'Add a hero to each side'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  content: { flexGrow: 1 },
  band: { background: undefined, backgroundColor: COLORS.deepNavy, paddingHorizontal: 32, paddingBottom: 22 },
  trays: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, maxWidth: 900, alignSelf: 'center', width: '100%' },
  trayCell: { flex: 1, maxWidth: 380 },
  vs: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.goldAccent },
  sheet: { backgroundColor: COLORS.beige, paddingHorizontal: 32, paddingTop: 20, gap: 14, maxWidth: 1100, alignSelf: 'center', width: '100%' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(41,60,67,0.12)', paddingHorizontal: 14, height: 46, gap: 9 },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy, outlineStyle: 'none' as unknown as undefined },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ctaWrap: { alignItems: 'center', paddingVertical: 24 },
  cta: { backgroundColor: COLORS.goldAccent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48, alignItems: 'center', minWidth: 300 },
  ctaDim: { backgroundColor: 'rgba(41,60,67,0.12)' },
  ctaTxt: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#1a130a', letterSpacing: 0.5, textAlign: 'center' },
  ctaTxtDim: { color: 'rgba(41,60,67,0.5)' },
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0. Reconcile any real prop mismatches (`useScreenChrome` signature, `OpponentCard` props) against the existing `pick.web.tsx`/`versus.web.tsx` usage. Remove the stray `background: undefined` if the linter objects — it's only there to defend against an RN-web style key; if tsc/lint flags it, delete that key.

- [ ] **Step 3: Web verification (device-screenshot workflow)**

Per the user's workflow, the user verifies web on their own device. Confirm via `yarn tsc` here; note the route is `/compare/pick`. Confirm both sides build, the active toggle works, and Battle routes by size.

- [ ] **Step 4: Commit**

```bash
git add app/compare/pick.web.tsx
git commit -m "feat(versus): web Battle Builder screen (top-bar trays + grid + battle CTA)"
```

---

## Task 7: Remove the superseded two-step picker

**Files:**
- Remove: `app/compare/[hero]/pick.tsx`, `app/compare/[hero]/pick.web.tsx`
- Possibly remove: `src/hooks/usePickOpponents.ts`
- Verify: nothing else imports the removed modules

- [ ] **Step 1: Find remaining consumers**

```bash
grep -rn "compare/\[hero\]/pick\|/pick?name=\|usePickOpponents\|PickOpponents" src app | grep -v "app/compare/\[hero\]/pick"
```
Expected: the only references are inside the files being removed (and the new `pick.tsx`/`pick.web.tsx` do NOT reference them — they use `useBattleBuilder`). If `usePickOpponents` has any consumer outside the removed two-step files, do NOT delete it; note the consumer in the report and leave it.

- [ ] **Step 2: Remove the two-step routes**

```bash
git rm app/compare/[hero]/pick.tsx app/compare/[hero]/pick.web.tsx
```

- [ ] **Step 3: Remove `usePickOpponents` only if unused**

If Step 1 showed no consumer outside the removed files:
```bash
git rm src/hooks/usePickOpponents.ts
```
Also remove any now-unused exports it depended on ONLY if they have no other consumer (check `getFamilyOpponents`, `getHeroesByPowerRange`, `dreamMatches` helpers with `grep` first; if used elsewhere, leave them).

- [ ] **Step 4: Typecheck + suite**

Run: `yarn tsc --noEmit` (expect 0) and `yarn test:ci` (expect all pass). Fix any dangling import the removal exposed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(versus): remove the superseded two-step picker (replaced by the Battle Builder)"
```

---

## Task 8: Full suite + typecheck green

**Files:** none (verification task)

- [ ] **Step 1: Full suite**

Run: `yarn test:ci`
Expected: all pass (including `battleBuilderState.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Lint the new files**

Run: `yarn eslint src/lib/battleBuilderState.ts src/hooks/useBattleBuilder.ts src/components/versus/RosterTray.tsx src/components/versus/TeammatesRail.tsx app/compare/pick.tsx app/compare/pick.web.tsx`
Expected: 0 errors (warnings tolerated per the repo's ratchet). Fix any error.

- [ ] **Step 4: Commit (if a fix was needed)**

```bash
git add -A
git commit -m "chore(versus): battle builder suite green"
```

---

## Self-Review Notes (coverage map)

- Spec §"Shared logic — useBattleBuilder" → Tasks 1 (pure rules) + 2 (hook).
- Spec §"Components" → `RosterTray` (Task 3), `TeammatesRail` (Task 4), native screen (Task 5), web screen (Task 6).
- Spec §"Decisions": active-side toggle + 5 fixed slots + add-only/remove-via-tray (RosterTray + screens); Teammates rail + live synergy + publisher badge (hook + RosterTray + TeammatesRail); Battle CTA gated on `canBattle`, routes via `resolveBattleRoute` (`battleHref`); replaces `/compare/pick` and removes the two-step flow (Task 7).
- Spec §"Edge cases": side-full / dup → `addToSide` no-op (Task 1, tested); empty → CTA disabled (`canBattle`); fetch failures → `TeammatesRail` returns null + synergy shows 0/hidden (degrade-to-hidden).
- Spec §"Testing" → `battleBuilderState.test.ts` (Task 1); `resolveBattleRoute` wiring covered by Phase 2a tests.
- **Deferred (per spec "Out of scope"):** naming/saving sides, AI verdicts for drafts, the side-full shake/toast polish (a subtle nudge can be added during screen iteration — the cap is already enforced), drag-to-reorder.
```
