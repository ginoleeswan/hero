# Native Versus Tab (matchup hub) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native **Versus** tab — a matchup hub (Today's Matchup, Surprise me, Greatest Rivalries, Build your own) routing into the existing arena, plus a real first-fighter picker replacing the `/compare/pick` redirect stub.

**Architecture:** New tab route `app/(tabs)/versus.tsx` renders four sections fed by one react-query hook over existing cross-platform data functions (`getTodaysMatchup`, `getTopRivalries`, `getIconicHeroes`). Tapping any matchup stashes both fighters' art and pushes `/compare/[a]/[b]`. "Build your own" routes to a repurposed `app/compare/pick.tsx` (search-driven first-fighter picker) → existing `/compare/[hero]/pick` → arena.

**Tech Stack:** Expo Router 4 (file-based + `expo-router/unstable-native-tabs`), React Native, `@tanstack/react-query`, expo-image, Ionicons, Supabase (read-only).

**Spec:** `docs/superpowers/specs/2026-06-11-native-versus-tab-design.md`

**Testing note:** Per `CLAUDE.md`, no full-screen render or navigation tests. Only the pure `pickRandomPair` helper is unit-tested. Everything else is verified by `tsc` + manual run.

---

## File Structure

- **Create** `src/lib/versus.ts` — `pickRandomPair(pool, rng?)` pure helper. (Task 1)
- **Create** `__tests__/lib/versus.test.ts` — unit tests. (Task 1)
- **Create** `src/hooks/useVersusHub.ts` — react-query hook → `{ matchup, rivalries, iconicPool, loading }`. (Task 2)
- **Create** `src/components/versus/TodaysMatchupCard.tsx` — native daily-matchup card. (Task 3)
- **Create** `src/components/versus/RivalriesRail.tsx` — native horizontal rivalries rail. (Task 4)
- **Create** `app/(tabs)/versus.tsx` — hub screen; **Modify** `app/(tabs)/_layout.tsx` — register tab. (Task 5)
- **Modify** `app/compare/pick.tsx` — first-fighter picker replacing the stub. (Task 6)

Reused as-is: `VsBadge`, `OpponentCard`, `HeroPeek`, `heroImageSource`, `stashFighters`/`FighterArt`, `useHeroSearchInfinite`.

---

### Task 1: `pickRandomPair` helper (TDD)

**Files:**
- Create: `src/lib/versus.ts`
- Test: `__tests__/lib/versus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/versus.test.ts
import { pickRandomPair } from '../../src/lib/versus';

const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('pickRandomPair', () => {
  it('returns null for pools smaller than 2', () => {
    expect(pickRandomPair([])).toBeNull();
    expect(pickRandomPair([{ id: 'a' }])).toBeNull();
  });

  it('returns two distinct items', () => {
    for (let k = 0; k < 50; k++) {
      const pair = pickRandomPair(pool);
      expect(pair).not.toBeNull();
      expect(pair![0].id).not.toBe(pair![1].id);
    }
  });

  it('uses the injected rng for deterministic indices', () => {
    // rng sequence: first call picks i, second call picks j (over length-1).
    const rng = jest
      .fn<number, []>()
      .mockReturnValueOnce(0) // i = floor(0 * 4) = 0
      .mockReturnValueOnce(0); // j = floor(0 * 3) = 0; 0 >= 0 → j += 1 → 1
    const pair = pickRandomPair(pool, rng);
    expect(pair).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('skips past i when the second index would collide (boundary)', () => {
    const rng = jest
      .fn<number, []>()
      .mockReturnValueOnce(0.5) // i = floor(0.5 * 4) = 2
      .mockReturnValueOnce(0.7); // j = floor(0.7 * 3) = 2; 2 >= 2 → j += 1 → 3
    const pair = pickRandomPair(pool, rng);
    expect(pair).toEqual([{ id: 'c' }, { id: 'd' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest versus.test --ci`
Expected: FAIL — `Cannot find module '../../src/lib/versus'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/versus.ts

/**
 * Pick two distinct items from a pool uniformly at random. Returns null when the
 * pool has fewer than 2 items. `rng` is injectable for deterministic tests.
 *
 * The second index is drawn over `length - 1` slots and shifted past the first
 * when it would collide — this keeps the pair distinct without the bias a
 * resample-on-collision loop introduces.
 */
export function pickRandomPair<T extends { id: string }>(
  pool: T[],
  rng: () => number = Math.random,
): [T, T] | null {
  if (pool.length < 2) return null;
  const i = Math.floor(rng() * pool.length);
  let j = Math.floor(rng() * (pool.length - 1));
  if (j >= i) j += 1;
  return [pool[i], pool[j]];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest versus.test --ci`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/versus.ts __tests__/lib/versus.test.ts
git commit -m "feat(versus): pickRandomPair helper for Surprise me"
```

---

### Task 2: `useVersusHub` data hook

**Files:**
- Create: `src/hooks/useVersusHub.ts`

Context: `getTodaysMatchup(): Promise<TodaysMatchup | null>` and `getTopRivalries(limit): Promise<Rivalry[]>` live in `src/lib/matchup.ts` and `src/lib/db/heroes.ts`. `getIconicHeroes(limit): Promise<Hero[]>` lives in `src/lib/db/heroes.ts`. `TodaysMatchup` is exported from `src/lib/matchup.ts`; `Rivalry` and `Hero` from `src/lib/db/heroes` / `src/types`.

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useVersusHub.ts
import { useQuery } from '@tanstack/react-query';
import { getTodaysMatchup, type TodaysMatchup } from '../lib/matchup';
import { getTopRivalries, getIconicHeroes, type Rivalry, type Hero } from '../lib/db/heroes';

/**
 * Backing data for the Versus hub: today's featured battle, the curated
 * rivalries rail, and an iconic-hero pool for "Surprise me". Each query caches
 * independently; a failure degrades to a hidden section, never a broken hub.
 */
export function useVersusHub() {
  const matchupQ = useQuery<TodaysMatchup | null>({
    queryKey: ['versus', 'todaysMatchup'],
    queryFn: getTodaysMatchup,
    staleTime: 1000 * 60 * 60, // an hour — the pair is stable for the day
  });

  const rivalriesQ = useQuery<Rivalry[]>({
    queryKey: ['versus', 'topRivalries', 12],
    queryFn: () => getTopRivalries(12),
    staleTime: 1000 * 60 * 30,
  });

  const iconicQ = useQuery<Hero[]>({
    queryKey: ['versus', 'iconicPool', 24],
    queryFn: () => getIconicHeroes(24),
    staleTime: 1000 * 60 * 30,
  });

  return {
    matchup: matchupQ.data ?? null,
    rivalries: rivalriesQ.data ?? [],
    iconicPool: iconicQ.data ?? [],
    loading: matchupQ.isPending || rivalriesQ.isPending || iconicQ.isPending,
  };
}
```

NOTE: confirm `getTodaysMatchup`, `Rivalry`, and `getIconicHeroes` are exported from the cited modules (they are, per the spec's audit). If `getTopRivalries`/`getIconicHeroes`/`Rivalry` are not all exported from `src/lib/db/heroes`, adjust the import path to wherever they are defined — do not duplicate them.

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`
Expected: no new errors. (Pre-existing `absoluteFillObject` / `app.config.ts` errors are unrelated.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVersusHub.ts
git commit -m "feat(versus): useVersusHub data hook"
```

---

### Task 3: `TodaysMatchupCard` native component

**Files:**
- Create: `src/components/versus/TodaysMatchupCard.tsx`

Context: `TodaysMatchup` shape is `{ heroA, heroB, winsA, winsB, verdict }` where each hero is `{ id, name, image_url, portrait_url, publisher }` (`MatchupHero`, assignable to `FighterArt`). `VsBadge` is `({ size?, variant? })`. `heroImageSource(id, image_url, portrait_url)` returns an expo-image source. `FighterArt` = `{ id, name?, image_url?, portrait_url? }`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/versus/TodaysMatchupCard.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { heroImageSource } from '../../constants/heroImages';
import { VsBadge } from '../compare/VsBadge';
import type { TodaysMatchup } from '../../lib/matchup';
import type { FighterArt } from '../../lib/compareHandoff';

export function TodaysMatchupCard({
  matchup,
  onOpen,
}: {
  matchup: TodaysMatchup;
  onOpen: (a: FighterArt, b: FighterArt) => void;
}) {
  const { heroA, heroB, verdict } = matchup;
  const imgA = heroImageSource(heroA.id, heroA.image_url, heroA.portrait_url);
  const imgB = heroImageSource(heroB.id, heroB.image_url, heroB.portrait_url);

  return (
    <Pressable
      onPress={() => onOpen(heroA, heroB)}
      accessibilityRole="button"
      accessibilityLabel={`Open today's matchup: ${heroA.name} versus ${heroB.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.portraits}>
        <View style={styles.portraitWrap}>
          <Image source={imgA} contentFit="cover" contentPosition="top" style={styles.portrait} />
          <View style={styles.scrim} />
          <Text style={styles.name} numberOfLines={1}>
            {heroA.name}
          </Text>
        </View>

        <View style={styles.badge}>
          <VsBadge size={48} variant="solid" />
        </View>

        <View style={styles.portraitWrap}>
          <Image source={imgB} contentFit="cover" contentPosition="top" style={styles.portrait} />
          <View style={styles.scrim} />
          <Text style={[styles.name, styles.nameRight]} numberOfLines={1}>
            {heroB.name}
          </Text>
        </View>
      </View>

      {verdict ? (
        <Text style={styles.verdict} numberOfLines={3}>
          “{verdict}”
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.12)',
  },
  cardPressed: { opacity: 0.92 },
  portraits: { flexDirection: 'row', height: 200 },
  portraitWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.navy },
  portrait: { ...StyleSheet.absoluteFillObject },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: 'rgba(12,17,20,0.55)',
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    padding: 12,
  },
  nameRight: { textAlign: 'right' },
  badge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  verdict: {
    fontFamily: 'Nunito_400Regular',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(245,235,220,0.82)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
```

NOTE: `StyleSheet.absoluteFillObject` triggers a known repo-wide pre-existing TS error pattern. If `tsc` flags `absoluteFillObject` on `portrait`, use `...StyleSheet.absoluteFill` style via `style={[StyleSheet.absoluteFill, ...]}` instead, matching how other native files in this repo handle full-fill images.

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`
Expected: no NEW errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/versus/TodaysMatchupCard.tsx
git commit -m "feat(versus): native Today's Matchup card"
```

---

### Task 4: `RivalriesRail` native component

**Files:**
- Create: `src/components/versus/RivalriesRail.tsx`

Context: `Rivalry` shape is `{ a, b, crossUniverse }` where `a`/`b` are `{ id, name, image_url, portrait_url }` (assignable to `FighterArt`).

- [ ] **Step 1: Create the component**

```tsx
// src/components/versus/RivalriesRail.tsx
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { heroImageSource } from '../../constants/heroImages';
import { VsBadge } from '../compare/VsBadge';
import type { Rivalry } from '../../lib/db/heroes';
import type { FighterArt } from '../../lib/compareHandoff';

function RivalryCard({ r, onPress }: { r: Rivalry; onPress: () => void }) {
  const imgA = heroImageSource(r.a.id, r.a.image_url, r.a.portrait_url);
  const imgB = heroImageSource(r.b.id, r.b.image_url, r.b.portrait_url);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.a.name} versus ${r.b.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Image source={imgA} contentFit="cover" contentPosition="top" style={styles.half} />
      <Image source={imgB} contentFit="cover" contentPosition="top" style={styles.half} />
      <View style={styles.scrim} />
      <View style={styles.badge}>
        <VsBadge size={34} variant="solid" />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {r.a.name} vs {r.b.name}
      </Text>
    </Pressable>
  );
}

export function RivalriesRail({
  rivalries,
  onOpen,
}: {
  rivalries: Rivalry[];
  onOpen: (a: FighterArt, b: FighterArt) => void;
}) {
  if (rivalries.length === 0) return null;
  return (
    <View>
      <Text style={styles.heading}>Greatest Rivalries</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {rivalries.map((r) => (
          <RivalryCard key={`${r.a.id}-${r.b.id}`} r={r} onPress={() => onOpen(r.a, r.b)} />
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_W = 220;
const CARD_H = 132;

const styles = StyleSheet.create({
  heading: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  row: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#1b2a30',
    justifyContent: 'flex-end',
  },
  cardPressed: { opacity: 0.9 },
  half: { width: CARD_W / 2, height: CARD_H },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,17,20,0.28)' },
  badge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.beige,
    backgroundColor: 'rgba(12,17,20,0.5)',
  },
});
```

NOTE: same `absoluteFillObject` caveat as Task 3 for the `scrim` — if `tsc` flags it, switch to `style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,17,20,0.28)' }]}`.

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`
Expected: no NEW errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/versus/RivalriesRail.tsx
git commit -m "feat(versus): native Greatest Rivalries rail"
```

---

### Task 5: Versus hub screen + tab registration

**Files:**
- Create: `app/(tabs)/versus.tsx`
- Modify: `app/(tabs)/_layout.tsx`

Context: sibling tab screens (`explore.tsx`) use a `View` root + `useSafeAreaInsets` and pad content down from `insets.top` (NativeTabs provides the bottom bar; there is no `Stack` header on tab screens). Follow the navy-stage / beige-sheet shell used across native screens. `stashFighters(...fighters)` caches art; `FighterArt` = `{ id, name?, image_url?, portrait_url? }`.

- [ ] **Step 1: Create the hub screen**

```tsx
// app/(tabs)/versus.tsx
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { useVersusHub } from '../../src/hooks/useVersusHub';
import { pickRandomPair } from '../../src/lib/versus';
import { stashFighters, type FighterArt } from '../../src/lib/compareHandoff';
import { TodaysMatchupCard } from '../../src/components/versus/TodaysMatchupCard';
import { RivalriesRail } from '../../src/components/versus/RivalriesRail';

export default function VersusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { matchup, rivalries, iconicPool, loading } = useVersusHub();

  const openArena = (a: FighterArt, b: FighterArt) => {
    stashFighters(a, b);
    router.push(`/compare/${a.id}/${b.id}`);
  };

  const surprise = () => {
    const pair = pickRandomPair(iconicPool);
    if (!pair) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openArena(pair[0], pair[1]);
  };

  const canSurprise = iconicPool.length >= 2;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navy stage */}
        <View style={[styles.stage, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.eyebrow}>SETTLE THE DEBATE</Text>
          <Text style={styles.title}>Versus</Text>
        </View>

        <View style={styles.sheet}>
          {loading && !matchup ? (
            <View style={styles.loading}>
              <ActivityIndicator color={COLORS.orange} />
            </View>
          ) : (
            <>
              {matchup ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Today’s Matchup</Text>
                  <TodaysMatchupCard matchup={matchup} onOpen={openArena} />
                </View>
              ) : null}

              <Pressable
                onPress={surprise}
                disabled={!canSurprise}
                accessibilityRole="button"
                accessibilityLabel="Surprise me with a random matchup"
                style={({ pressed }) => [
                  styles.surprise,
                  pressed && styles.surprisePressed,
                  !canSurprise && styles.surpriseDisabled,
                ]}
              >
                <Ionicons name="shuffle" size={18} color={COLORS.beige} />
                <Text style={styles.surpriseText}>Surprise me</Text>
              </Pressable>

              <View style={styles.section}>
                <RivalriesRail rivalries={rivalries} onOpen={openArena} />
              </View>

              <Pressable
                onPress={() => router.push('/compare/pick')}
                accessibilityRole="button"
                accessibilityLabel="Build your own matchup"
                style={({ pressed }) => [styles.build, pressed && styles.buildPressed]}
              >
                <View style={styles.buildIcon}>
                  <Ionicons name="git-compare" size={20} color={COLORS.orange} />
                </View>
                <View style={styles.buildTextWrap}>
                  <Text style={styles.buildTitle}>Build your own</Text>
                  <Text style={styles.buildSub}>Pick any two fighters</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(41,60,67,0.4)" />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flex: 1, backgroundColor: COLORS.navy },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: 16, paddingBottom: 28 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.beige },
  sheet: {
    backgroundColor: COLORS.navy,
    paddingTop: 8,
    gap: 26,
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
  section: { paddingHorizontal: 0 },
  sectionLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  // Surprise me — orange brand CTA
  surprise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.orange,
  },
  surprisePressed: { opacity: 0.9 },
  surpriseDisabled: { opacity: 0.4 },
  surpriseText: { fontFamily: 'Nunito_900Black', fontSize: 15, color: COLORS.beige },
  // Build your own — beige row card
  build: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.beige,
  },
  buildPressed: { opacity: 0.9 },
  buildIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.14)',
  },
  buildTextWrap: { flex: 1 },
  buildTitle: { fontFamily: 'Nunito_900Black', fontSize: 15, color: COLORS.navy },
  buildSub: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: 'rgba(41,60,67,0.6)' },
});
```

- [ ] **Step 2: Register the tab**

In `app/(tabs)/_layout.tsx`, add this trigger between the `search` and `profile` triggers:

```tsx
      <NativeTabs.Trigger name="versus">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="git-compare" />}
        />
        <NativeTabs.Trigger.Label>Versus</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
```

(`Ionicons` and `NativeTabs` are already imported in that file.)

- [ ] **Step 3: Type-check**

Run: `yarn tsc --noEmit`
Expected: no NEW errors in `app/(tabs)/versus.tsx` or `app/(tabs)/_layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/versus.tsx" "app/(tabs)/_layout.tsx"
git commit -m "feat(versus): native Versus hub tab (Today's Matchup, Surprise, Rivalries, Build your own)"
```

---

### Task 6: First-fighter picker (replace `/compare/pick` stub)

**Files:**
- Modify: `app/compare/pick.tsx`

Context: currently `app/compare/pick.tsx` is `<Redirect href="/explore" />`. Replace it with a subject-less "pick fighter A" screen modelled on `app/compare/[hero]/pick.tsx` (read that file for the navy-stage/beige-sheet shell, header options, search row, and skeleton). Differences: no `VsAnchor` (no subject yet), eyebrow reads "Choose your first fighter", roster + search come from `useHeroSearchInfinite(query, 'All', 'All')` (the same query the Search tab uses), and picking routes to the existing opponent picker `/compare/[id]/pick?name=…`.

`useHeroSearchInfinite(query, publisher, alignment)` returns an infinite query whose `data.pages` are `HeroSearchResult[]` (`{ id, name, image_url, portrait_url, publisher, alignment, … }`). `OpponentCard` takes `{ item: {id,name,image_url?,portrait_url?}, onPress, onLongPress?, width?, height? }`. `HeroPeek` takes `{ hero: PeekHero, onClose, onFight, onViewProfile }`. `PeekHero` = `{ id, name, full_name?, publisher?, alignment?, image_url?, portrait_url? }`.

- [ ] **Step 1: Replace the file**

```tsx
// app/compare/pick.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { CardSkeleton } from '../../src/components/compare/CardSkeleton';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GRID_GAP) / 2;
const CARD_H = Math.round(CARD_W * 1.4);

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor: COLORS.beige,
  headerBackButtonDisplayMode: 'minimal',
} as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PickSkeleton() {
  return (
    <View style={styles.skelGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} width={CARD_W} height={CARD_H} />
      ))}
    </View>
  );
}

export default function PickFirstFighterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const headerHeight = insets.top + (Platform.OS === 'ios' ? 44 : 56);

  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const debouncedQuery = useDebounce(query, 200);

  const searchQ = useHeroSearchInfinite(debouncedQuery, 'All', 'All');
  const heroes = useMemo(
    () => (searchQ.data?.pages ?? []).flat().slice(0, 120),
    [searchQ.data],
  );
  const loading = searchQ.isPending;

  const handlePick = (id: string, name: string) => {
    Haptics.selectionAsync();
    router.push(`/compare/${id}/pick?name=${encodeURIComponent(name)}`);
  };

  const header = (
    <>
      <View style={[styles.stage, { paddingTop: headerHeight + 12 }]}>
        <Text style={styles.eyebrow}>Choose your first fighter</Text>
        <Text style={styles.title}>Who’s in the ring?</Text>
      </View>

      <View style={styles.sheetTop}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color="rgba(41,60,67,0.4)" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search any hero or villain…"
            placeholderTextColor="rgba(41,60,67,0.38)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={19} color="rgba(41,60,67,0.4)" />
            </Pressable>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />
      <FlatList
        style={styles.list}
        data={loading ? [] : heroes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <PickSkeleton />
          ) : (
            <Text style={styles.empty}>No heroes found</Text>
          )
        }
        onEndReached={() => {
          if (searchQ.hasNextPage && !searchQ.isFetchingNextPage) searchQ.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <OpponentCard
            item={item}
            onPress={() => handlePick(item.id, item.name)}
            onLongPress={() => setPeek(item)}
            width={CARD_W}
            height={CARD_H}
          />
        )}
      />

      {peek && (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => {
            const { id, name } = peek;
            setPeek(null);
            handlePick(id, name);
          }}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  list: { flex: 1, backgroundColor: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },

  stage: { backgroundColor: COLORS.navy, paddingBottom: 34, paddingHorizontal: H_PAD },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.beige },

  sheetTop: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingTop: 22,
    paddingHorizontal: H_PAD,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    height: 46,
    gap: 9,
    marginBottom: 22,
  },
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },

  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP, paddingHorizontal: H_PAD },
  skelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: H_PAD,
  },
  empty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(41,60,67,0.6)',
    textAlign: 'center',
    paddingTop: 40,
  },
});
```

NOTE on the empty-query roster: confirm `useHeroSearchInfinite('', 'All', 'All')` returns a sensible default browse list (the Search tab relies on the same hook, so an empty `q` should already yield a roster). If empty `q` returns `[]`, seed the empty state by showing iconic/popular heroes instead — read `app/(tabs)/search/index.tsx` to mirror exactly how it renders the no-query state, and reuse that approach rather than inventing a new one.

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`
Expected: no NEW errors in `app/compare/pick.tsx`.

- [ ] **Step 3: Run the full test suite (no regressions)**

Run: `yarn test:ci`
Expected: all suites pass (including the new `versus.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add "app/compare/pick.tsx"
git commit -m "feat(compare): real first-fighter picker replacing /compare/pick stub"
```

- [ ] **Step 5: Manual verification (whole feature)**

Run the app on iOS (`yarn start`). Confirm:
- A **Versus** tab (git-compare icon) appears between Search and Profile.
- Today's Matchup card renders and opens the arena for that pair.
- "Surprise me" opens an arena for two **distinct** iconic heroes; repeated taps vary.
- Greatest Rivalries rail scrolls; each card opens the right arena.
- "Build your own" → first-fighter picker (search works) → tap a hero → opponent picker → arena.
- Sections with no data are hidden rather than broken.

---

## Self-Review

**Spec coverage:**
- Tab registration (Explore·Search·Versus·Profile, git-compare) → Task 5 Step 2. ✓
- `useVersusHub` (matchup + rivalries + iconicPool) → Task 2. ✓
- Today's Matchup section/card → Task 3 + Task 5. ✓
- Surprise me (pickRandomPair, distinct, disabled <2) → Task 1 + Task 5. ✓
- Greatest Rivalries rail → Task 4 + Task 5. ✓
- Build your own → first-fighter picker → existing opponent picker → Task 5 + Task 6. ✓
- `openArena` stash-then-push → Task 5. ✓
- Repurpose `/compare/pick` stub → Task 6. ✓
- Error/empty hiding → Tasks 3/4 (return null on empty) + Task 5 (conditional render). ✓
- `pickRandomPair` unit tests incl. boundary → Task 1. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows full code. The two NOTEs (absoluteFillObject fallback; empty-query roster) are explicit contingencies with concrete instructions, not deferred work.

**Type consistency:** `openArena(a: FighterArt, b: FighterArt)` is fed `MatchupHero` (Task 3), `Rivalry.a/b` (Task 4), and iconic `Hero` (Task 5 via pickRandomPair) — all structurally assignable to `FighterArt` (`{id,name?,image_url?,portrait_url?}`). `useVersusHub` returns `{ matchup, rivalries, iconicPool, loading }` — exactly the fields Task 5 destructures. `pickRandomPair` signature in Task 1 matches the call in Task 5. `useHeroSearchInfinite(query, 'All', 'All')` matches the `(query, PublisherFilter, AlignmentFilter)` signature, and `'All'` is valid for both filter types. `OpponentCard`/`HeroPeek`/`VsBadge` props match their definitions.
