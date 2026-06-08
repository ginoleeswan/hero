# Search Screen Native Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the native Search tab as a dark-navy-glass surface using the genuine iOS `UISearchController` (native header search bar), a custom publisher scope row, a gold sword-rail, and the existing `PortraitCard` grid.

**Architecture:** The `search` route becomes a nested native `Stack` so it can host `headerSearchBarOptions` (the real iOS search bar). The screen body renders on a deep-navy canvas with an orange top-glow. The publisher filter moves to a custom Apple-style scope row pinned below the native header (the native search bar has no scope API). Existing data/query logic is reused; one pure filter helper is extracted and unit-tested.

**Tech Stack:** Expo SDK 55, expo-router 4 (`Stack` + native tabs), react-native-screens 4.23 (`headerSearchBarOptions`), expo-blur (new), expo-linear-gradient, expo-image, react-native-reanimated, jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-06-07-search-screen-native-redesign-design.md`

**Branch:** `feat/search-native-redesign` (already checked out; spec already committed there).

**Testing note:** Per `CLAUDE.md`, we unit-test pure logic and small components only — not full screens or navigation. So Tasks 2–3 are TDD; Tasks 1, 4–8 are verified via `yarn tsc --noEmit`, `yarn test:ci` (no regressions), and a manual device/simulator check. That split is intentional, not an omission.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/db/heroes.ts` | **Modify** — add pure `filterHeroesByPublisher(heroes, filter)` helper. |
| `__tests__/lib/db/heroes.publisherFilter.test.ts` | **New** — unit tests for the helper. |
| `src/components/search/ScopeBar.tsx` | **New** — Apple-style publisher scope segments (All/Marvel/DC/Other). |
| `__tests__/components/ScopeBar.test.tsx` | **New** — render + onChange tests. |
| `src/components/search/AccentRail.tsx` | **New** — shared gold sword-rail header + horizontal `OpponentCard` row (extracted from `pick.tsx`). |
| `app/compare/[hero]/pick.tsx` | **Modify** — consume `AccentRail`, delete the local `Rail` + its exclusive styles. |
| `src/components/search/PortraitCard.tsx` | **Modify** — add `onDark?: boolean` prop → faint light edge. |
| `app/(tabs)/search/_layout.tsx` | **New** — native `Stack`, navy large-title header, `headerSearchBarOptions` styling. |
| `app/(tabs)/search/index.tsx` | **New** — the reworked dark screen (query state, scope row, rails, grid, states). |
| `app/(tabs)/search/index.web.tsx` | **Moved** — from `app/(tabs)/search.web.tsx`, verbatim. |
| `app/(tabs)/search.tsx` | **Delete** — replaced by `search/index.tsx`. |
| `app/(tabs)/search.web.tsx` | **Delete** — moved into `search/index.web.tsx`. |

---

## Task 1: Add expo-blur dependency

**Files:**
- Modify: `package.json` (via installer)

- [ ] **Step 1: Install expo-blur (pinned by Expo)**

Run: `yarn expo install expo-blur`
Expected: `expo-blur` added to `package.json` dependencies at an SDK-55-compatible version.

- [ ] **Step 2: Verify it imports**

Run: `yarn tsc --noEmit`
Expected: PASS (no new type errors).

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "build(search): add expo-blur for scope-bar frost"
```

---

## Task 2: Extract `filterHeroesByPublisher` pure helper (TDD)

The idle-state publisher filter is currently inline in the screen. Extract it as a tested pure function so the new screen reuses it.

**Files:**
- Test: `__tests__/lib/db/heroes.publisherFilter.test.ts`
- Modify: `src/lib/db/heroes.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/db/heroes.publisherFilter.test.ts
import { filterHeroesByPublisher } from '../../../src/lib/db/heroes';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';

const make = (id: string, publisher: string | null): HeroSearchResult =>
  ({
    id,
    name: id,
    publisher,
    alignment: null,
    image_md_url: null,
    image_url: null,
    portrait_url: null,
    full_name: null,
    aliases: null,
  }) as HeroSearchResult;

const heroes = [
  make('a', 'Marvel Comics'),
  make('b', 'DC Comics'),
  make('c', 'Dark Horse Comics'),
  make('d', null),
];

describe('filterHeroesByPublisher', () => {
  it('returns all heroes for "All"', () => {
    expect(filterHeroesByPublisher(heroes, 'All')).toHaveLength(4);
  });

  it('keeps only Marvel for "Marvel"', () => {
    expect(filterHeroesByPublisher(heroes, 'Marvel').map((h) => h.id)).toEqual(['a']);
  });

  it('keeps only DC for "DC"', () => {
    expect(filterHeroesByPublisher(heroes, 'DC').map((h) => h.id)).toEqual(['b']);
  });

  it('keeps everything that is neither Marvel nor DC for "Other" (incl. null publisher)', () => {
    expect(filterHeroesByPublisher(heroes, 'Other').map((h) => h.id)).toEqual(['c', 'd']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/lib/db/heroes.publisherFilter.test.ts`
Expected: FAIL — `filterHeroesByPublisher is not a function` / import undefined.

- [ ] **Step 3: Implement the helper**

Add to `src/lib/db/heroes.ts` immediately after the `PublisherFilter` type (line 8) — or anywhere top-level after the `HeroSearchResult` type is declared; place it after `rankResults` to keep search helpers together:

```typescript
/**
 * Pure publisher filter for already-fetched idle heroes (the server applies the
 * same predicate for live searches; this mirrors it client-side for the idle
 * grid so the scope bar can re-filter without a round-trip).
 */
export function filterHeroesByPublisher<T extends { publisher?: string | null }>(
  heroes: T[],
  filter: PublisherFilter,
): T[] {
  if (filter === 'All') return heroes;
  return heroes.filter((h) => {
    const pub = (h.publisher ?? '').toLowerCase();
    if (filter === 'Marvel') return pub.includes('marvel');
    if (filter === 'DC') return pub.includes('dc');
    return !pub.includes('marvel') && !pub.includes('dc');
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/lib/db/heroes.publisherFilter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.publisherFilter.test.ts
git commit -m "feat(search): add filterHeroesByPublisher pure helper"
```

---

## Task 3: ScopeBar component (TDD)

Apple-style segmented publisher scope row. Active segment = solid beige pill (navy text); inactive = translucent glass (beige text) on the dark canvas.

**Files:**
- Test: `__tests__/components/ScopeBar.test.tsx`
- Create: `src/components/search/ScopeBar.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/ScopeBar.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ScopeBar } from '../../src/components/search/ScopeBar';

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));

describe('ScopeBar', () => {
  it('renders all four scopes', () => {
    const { getByTestId } = render(<ScopeBar value="All" onChange={() => {}} />);
    expect(getByTestId('scope-All')).toBeTruthy();
    expect(getByTestId('scope-Marvel')).toBeTruthy();
    expect(getByTestId('scope-DC')).toBeTruthy();
    expect(getByTestId('scope-Other')).toBeTruthy();
  });

  it('calls onChange with the pressed scope', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<ScopeBar value="All" onChange={onChange} />);
    fireEvent.press(getByTestId('scope-Marvel'));
    expect(onChange).toHaveBeenCalledWith('Marvel');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/components/ScopeBar.test.tsx`
Expected: FAIL — cannot resolve `../../src/components/search/ScopeBar`.

- [ ] **Step 3: Implement ScopeBar**

```tsx
// src/components/search/ScopeBar.tsx — Apple-style publisher scope segments.
// Lives on the dark search canvas, pinned below the native search header.
import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import type { PublisherFilter } from '../../lib/db/heroes';

const SCOPES: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];

export const ScopeBar = memo(function ScopeBar({
  value,
  onChange,
}: {
  value: PublisherFilter;
  onChange: (v: PublisherFilter) => void;
}) {
  return (
    <View style={styles.row}>
      {SCOPES.map((scope) => {
        const active = scope === value;
        return (
          <Pressable
            key={scope}
            testID={`scope-${scope}`}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(scope);
            }}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{scope}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  seg: {
    paddingHorizontal: 15,
    height: 32,
    justifyContent: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.14)',
  },
  segActive: { backgroundColor: COLORS.beige, borderColor: COLORS.beige },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: 'rgba(245,235,220,0.62)' },
  labelActive: { color: COLORS.navy },
});
```

Note: the test mocks `expo-blur`; the component above doesn't import it (translucent fill is enough at this size). The mock is harmless and lets us add a `BlurView` later without touching the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/components/ScopeBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/search/ScopeBar.tsx __tests__/components/ScopeBar.test.tsx
git commit -m "feat(search): add ScopeBar publisher segment row"
```

---

## Task 4: Extract AccentRail (shared gold sword-rail)

Move the rail pattern out of `pick.tsx` into a reusable component so Search and Pick share it. Same props/behavior — Pick must look identical after.

**Files:**
- Create: `src/components/search/AccentRail.tsx`
- Modify: `app/compare/[hero]/pick.tsx`

- [ ] **Step 1: Create AccentRail**

```tsx
// src/components/search/AccentRail.tsx — horizontal hero rail with two header
// styles: a gold "sword" header (accent) or a plain uppercase label. Extracted
// from the opponent picker so Search and Pick share one rail.
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { OpponentCard } from '../compare/OpponentCard';
import type { PeekHero } from '../compare/HeroPeek';
import { COLORS } from '../../constants/colors';

const H_PAD = 16;
const RAIL_W = 116;
const RAIL_H = 158;

export interface AccentRailItem {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}

export function AccentRail({
  label,
  items,
  onPick,
  onPeek,
  accent,
  tagline,
}: {
  label: string;
  items: AccentRailItem[];
  onPick: (id: string) => void;
  onPeek: (item: PeekHero) => void;
  accent?: boolean;
  tagline?: string;
}) {
  return (
    <View style={styles.section}>
      {accent ? (
        <View style={styles.rivalHead}>
          <Text style={styles.swords}>⚔</Text>
          <Text style={styles.rivalLabel}>{label}</Text>
          <View style={styles.rivalBar} />
        </View>
      ) : (
        <Text style={styles.sectionLabel}>{label}</Text>
      )}
      {accent && tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railScroll}
        contentContainerStyle={styles.railRow}
      >
        {items.map((item) => (
          <OpponentCard
            key={item.id}
            item={item}
            onPress={() => onPick(item.id)}
            onLongPress={() => onPeek(item)}
            width={RAIL_W}
            height={RAIL_H}
            compact
            accent={accent}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 11,
  },
  railScroll: { marginHorizontal: -H_PAD },
  railRow: { gap: 11, paddingLeft: H_PAD, paddingRight: H_PAD, paddingTop: 4, paddingBottom: 8 },
  rivalHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 3 },
  swords: { fontSize: 15, color: COLORS.gold },
  rivalLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rivalBar: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(176,125,0,0.28)' },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    fontStyle: 'italic',
    color: 'rgba(41,60,67,0.55)',
    marginBottom: 11,
  },
});
```

- [ ] **Step 2: Refactor `pick.tsx` to use AccentRail**

In `app/compare/[hero]/pick.tsx`:

1. Add import near the other compare imports (after the `VsAnchor` import, line ~22):

```tsx
import { AccentRail } from '../../../src/components/search/AccentRail';
```

2. **Delete** the local `Rail` function component (lines ~56–104, the whole `function Rail({...}) {...}` block).

3. Replace the three `<Rail .../>` usages (lines ~195–210) with `<AccentRail .../>` — props are identical:

```tsx
{rivals.length > 0 && (
  <AccentRail
    label="Rivalries"
    items={rivals}
    onPick={handlePick}
    onPeek={openPeek}
    accent
    tagline="The grudge matches fans want to see."
  />
)}
{sameUniverse.length > 0 && (
  <AccentRail label="Same Universe" items={sameUniverse} onPick={handlePick} onPeek={openPeek} />
)}
{similar.length > 0 && (
  <AccentRail label="Similar Power" items={similar} onPick={handlePick} onPeek={openPeek} />
)}
```

4. Delete the now-unused style keys from `pick.tsx`'s `StyleSheet.create` that were used **only** by the local `Rail`: `section`, `railScroll`, `railRow`, `rivalHead`, `swords`, `rivalLabel`, `rivalBar`, `tagline`. **Keep** `sectionLabel` and `allLabel` — they are still used by the "All Heroes" label (line ~211). Also keep `RAIL_W`/`RAIL_H` consts only if still referenced by `PickSkeleton` (they are — leave them).

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: PASS — no unused-variable or missing-import errors. (If TS flags an unused style, you missed one in step 4 / kept one you shouldn't have.)

- [ ] **Step 4: Visual regression check (manual)**

Run the app, open a hero → "Fight" → the Pick screen. Confirm the Rivalries (gold sword header + tagline), Same Universe, and Similar Power rails look exactly as before.

Run: `yarn start` (then open iOS simulator / device)
Expected: Pick screen rails unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/search/AccentRail.tsx "app/compare/[hero]/pick.tsx"
git commit -m "refactor(compare): extract AccentRail shared rail from pick"
```

---

## Task 5: PortraitCard dark-canvas edge

Add an `onDark` prop that draws a faint light hairline so navy cards separate from the dark search canvas. Default (web/other callers) is unchanged.

**Files:**
- Modify: `src/components/search/PortraitCard.tsx`

- [ ] **Step 1: Add the prop and edge style**

In `src/components/search/PortraitCard.tsx`:

1. Add `onDark` to the props type:

```tsx
export function PortraitCard({
  item,
  cardWidth,
  onPress,
  onLongPress,
  disabled,
  onDark,
}: {
  item: HeroSearchResult;
  cardWidth: number;
  onPress: () => void;
  onLongPress?: () => void;
  disabled: boolean;
  onDark?: boolean;
}) {
```

2. Apply the edge to the card `View` (the `style={styles.card}` at line ~51):

```tsx
<View style={[styles.card, onDark && styles.cardOnDark]}>
```

3. Add the style key to `StyleSheet.create`:

```tsx
  cardOnDark: { boxShadow: '0 0 0 1px rgba(245,235,220,0.08)' },
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/search/PortraitCard.tsx
git commit -m "feat(search): add onDark edge to PortraitCard"
```

---

## Task 6: Restructure the search route into a native Stack

Convert the single `search.tsx` route into a folder with a native `Stack` layout that hosts the iOS search header. Move the web variant verbatim. (The screen body comes in Task 7 — here we just stand up the structure so the app still builds.)

**Files:**
- Create: `app/(tabs)/search/_layout.tsx`
- Create: `app/(tabs)/search/index.web.tsx` (moved from `search.web.tsx`)
- Delete: `app/(tabs)/search.web.tsx`
- Temporary: keep `app/(tabs)/search.tsx` until Task 7 moves it; see steps.

- [ ] **Step 1: Move the web variant verbatim**

```bash
git mv "app/(tabs)/search.web.tsx" "app/(tabs)/search/index.web.tsx"
```

(`git mv` into a new folder creates `app/(tabs)/search/`.)

- [ ] **Step 2: Move the current native screen into the folder as the index (kept as-is for now)**

```bash
git mv "app/(tabs)/search.tsx" "app/(tabs)/search/index.tsx"
```

Now `search/index.tsx` is the **old** screen content; Task 7 rewrites it. This keeps the app building between tasks.

- [ ] **Step 3: Create the native Stack layout**

```tsx
// app/(tabs)/search/_layout.tsx — native Stack so the Search screen can host the
// real iOS UISearchController (headerSearchBarOptions). The navy large-title
// header makes Search a dark "command surface" matching the arena.
import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/colors';

const SEARCH_NAVY = '#1a262b';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLargeTitle: true,
        headerTitle: 'Search',
        headerStyle: { backgroundColor: SEARCH_NAVY },
        headerLargeStyle: { backgroundColor: SEARCH_NAVY },
        headerShadowVisible: false,
        headerTintColor: COLORS.orange,
        headerTitleStyle: { color: COLORS.beige },
        headerLargeTitleStyle: { color: COLORS.beige },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
```

Note: `headerSearchBarOptions` is set per-screen in Task 7 (so its callbacks can drive the screen's query state). `headerLargeTitleStyle.fontFamily` is intentionally omitted here — see Risk 1 in the spec; add `fontFamily: 'Flame-Bold'` in Task 7 only if it renders.

- [ ] **Step 4: Verify routing still works**

Run: `yarn tsc --noEmit` then `yarn start`
Expected: PASS; the Search tab still opens (old screen content, now under a navy native header). The native header may overlap the old screen's custom "Search" title — that is expected and removed in Task 7.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/search/_layout.tsx" "app/(tabs)/search/index.web.tsx" "app/(tabs)/search/index.tsx"
git commit -m "refactor(search): nest search route in a native Stack layout"
```

---

## Task 7: Rebuild the search screen (dark navy glass + native search)

Rewrite `app/(tabs)/search/index.tsx` as the dark screen: query driven by the native search bar, custom scope row, gold Recently-Viewed rail, Popular/results grid, dark empty + loading states.

**Files:**
- Replace: `app/(tabs)/search/index.tsx`

- [ ] **Step 1: Write the new screen**

Replace the entire contents of `app/(tabs)/search/index.tsx` with:

```tsx
// app/(tabs)/search/index.tsx — Search tab. Native iOS search bar (UISearchController)
// in the nav header drives the query; a custom scope row below it filters by
// publisher. Dark navy glass canvas unifies Search with the arena/pick pages.
// Idle shows Recently Viewed (gold rail) + Popular; typing swaps in results.
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../src/constants/colors';
import { PortraitCard } from '../../../src/components/search/PortraitCard';
import { ScopeBar } from '../../../src/components/search/ScopeBar';
import { AccentRail } from '../../../src/components/search/AccentRail';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../../src/components/ui/SkeletonProvider';
import {
  searchHeroes,
  rankResults,
  getSearchIdleHeroes,
  filterHeroesByPublisher,
  type HeroSearchResult,
  type PublisherFilter,
} from '../../../src/lib/db/heroes';
import { getRecentlyViewed } from '../../../src/lib/db/viewHistory';
import { useAuth } from '../../../src/hooks/useAuth';
import type { FavouriteHero } from '../../../src/types';

const SEARCH_NAVY = '#1a262b';
const GRID_COLUMNS = 2;
const H_PAD = 16;
const GAP = 8;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [idleHeroes, setIdleHeroes] = useState<HeroSearchResult[]>([]);
  const [idleLoading, setIdleLoading] = useState(true);
  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [searchResults, setSearchResults] = useState<HeroSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const [navigating, setNavigating] = useState(false);
  const [peek, setPeek] = useState<PeekHero | null>(null);

  const cardWidth = (width - H_PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const debouncedQuery = useDebounce(query, 300);

  // Wire the native iOS search bar into the screen's query state. Set once on
  // mount — setQuery is stable, so onChangeText/onCancel keep working without
  // re-registering the options each render.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Hero, villain, or real name…',
        barTintColor: 'rgba(245,235,220,0.12)',
        textColor: COLORS.beige,
        hintTextColor: 'rgba(245,235,220,0.5)',
        tintColor: COLORS.orange,
        hideWhenScrolling: false,
        autoCapitalize: 'none',
        onChangeText: (e: { nativeEvent: { text: string } }) => setQuery(e.nativeEvent.text),
        onCancelButtonPress: () => setQuery(''),
      },
    });
  }, [navigation]);

  useEffect(() => {
    getSearchIdleHeroes(30)
      .then(setIdleHeroes)
      .catch(() => {})
      .finally(() => setIdleLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id)
      .then(setRecentlyViewed)
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchResults(null);

    searchHeroes(debouncedQuery, publisherFilter, 100)
      .then((results) => {
        if (!cancelled) setSearchResults(rankResults(results, debouncedQuery));
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, publisherFilter]);

  const displayedHeroes = useMemo(() => {
    if (searchResults !== null) return searchResults.slice(0, 100);
    return filterHeroesByPublisher(idleHeroes, publisherFilter);
  }, [idleHeroes, searchResults, publisherFilter]);

  const handlePress = useCallback(
    (item: { id: string; portrait_url?: string | null; image_url?: string | null }) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      const img = item.portrait_url ?? item.image_url;
      const suffix = img ? `?imageUri=${encodeURIComponent(img)}` : '';
      router.push(`/character/${item.id}${suffix}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating],
  );

  const openPeek = useCallback((item: PeekHero) => {
    Haptics.selectionAsync();
    setPeek(item);
  }, []);

  const isIdle = searchResults === null;
  const showRecent = isIdle && !query.trim() && recentlyViewed.length > 0;

  const listHeader = (
    <>
      {showRecent && (
        <AccentRail
          label="Recently Viewed"
          items={recentlyViewed}
          onPick={(id) => {
            const h = recentlyViewed.find((r) => r.id === id);
            if (h) handlePress(h);
          }}
          onPeek={openPeek}
          accent
        />
      )}
      {!idleLoading && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            {isIdle
              ? 'Popular'
              : `${displayedHeroes.length} result${displayedHeroes.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(231,115,51,0.22)', 'transparent']}
        locations={[0, 0.55]}
        style={styles.glow}
        pointerEvents="none"
      />

      <ScopeBar value={publisherFilter} onChange={setPublisherFilter} />

      {idleLoading ? (
        <SkeletonProvider>
          <View style={[styles.grid, styles.skelGrid]}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                width={cardWidth}
                height={Math.round(cardWidth * 1.48)}
                borderRadius={10}
              />
            ))}
          </View>
        </SkeletonProvider>
      ) : displayedHeroes.length === 0 && !isSearching ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="search-outline" size={30} color={COLORS.orange} />
          </View>
          <Text style={styles.emptyHeadline}>No heroes found</Text>
          <Text style={styles.emptySub}>Try a different search or filter</Text>
        </View>
      ) : (
        <FlatList
          data={displayedHeroes}
          keyExtractor={(h) => h.id}
          numColumns={GRID_COLUMNS}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 120 }]}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <PortraitCard
              item={item}
              cardWidth={cardWidth}
              onPress={() => handlePress(item)}
              onLongPress={() => openPeek(item)}
              disabled={navigating}
              onDark
            />
          )}
        />
      )}

      {peek && (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => router.push(`/compare/${peek.id}/pick`)}
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
  root: { flex: 1, backgroundColor: SEARCH_NAVY },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  grid: { paddingHorizontal: H_PAD, paddingTop: 4 },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  gridRow: { gap: GAP },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,235,220,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: 'rgba(245,235,220,0.55)' },
  sectionHeader: { paddingBottom: 8, paddingTop: 4 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
  },
});
```

Key changes from the old screen: the custom title + `TextInput` search bar and the old pill `ScrollView` are gone (replaced by the native header search + `ScopeBar`); canvas is `SEARCH_NAVY` with an orange `LinearGradient` glow; the idle filter uses `filterHeroesByPublisher`; cards pass `onDark`; the "Recently Viewed" row is now the gold `AccentRail`; empty/loading restyled for dark.

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: PASS. If `navigation.setOptions` complains about `headerSearchBarOptions` typing, cast the options object: `navigation.setOptions({ headerSearchBarOptions: { ... } } as never)` — the native-stack augments the type at runtime; this matches how other screens in the repo set native options.

- [ ] **Step 3: Run the existing test suite (no regressions)**

Run: `yarn test:ci`
Expected: PASS — same suite as before plus Tasks 2–3 tests.

- [ ] **Step 4: Manual verification (simulator/device)**

Run: `yarn start`
Confirm:
- Search tab shows a large "Search" title that collapses on scroll; the native iOS search field sits in the nav bar.
- Typing filters live; the result-count label appears; clearing returns to Popular.
- Scope row (All/Marvel/DC/Other) filters both idle and search results.
- Idle shows the gold "⚔ Recently Viewed" rail (when signed in with history) and the Popular grid; cards have a faint edge on the dark canvas.
- Long-press a card → HeroPeek → Fight/View Profile work.
- Status bar text is light over the navy header.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/search/index.tsx"
git commit -m "feat(search): dark navy glass screen with native iOS search"
```

---

## Task 8: Final verification & cleanup

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + tests**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: both PASS.

- [ ] **Step 2: Confirm web search is intact**

Run: `yarn start` → open in web browser → Search.
Expected: the web search experience is unchanged (served from `search/index.web.tsx`).

- [ ] **Step 3: Confirm no leftover files**

Run: `ls "app/(tabs)" | grep search`
Expected: only `search` (the folder). No stray `search.tsx` / `search.web.tsx`.

- [ ] **Step 4: Verify against spec success criteria**

Re-read the spec's "Success criteria" section and confirm each bullet holds. Note any deviations (e.g. if `hideWhenScrolling` was toggled, or the Flame font didn't apply to the large title).

- [ ] **Step 5: Final commit (if anything adjusted)**

```bash
git add -A
git commit -m "chore(search): finalize native redesign" || echo "nothing to finalize"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** Native search bar (Tasks 6–7) ✓; dark navy glass canvas + glow (7) ✓; custom scope row replacing native scopes (3, 7) ✓; route restructured to nested Stack (6) ✓; existing PortraitCards kept + dark edge (5, 7) ✓; gold sword-rail Recently Viewed via shared AccentRail (4, 7) ✓; Popular/results/empty/loading states (7) ✓; expo-blur dependency (1) ✓; web preserved (6, 8) ✓; out-of-scope items (featured card, Fight CTA) correctly excluded ✓.
- **Placeholder scan:** none — every code step shows full content.
- **Type consistency:** `filterHeroesByPublisher`, `PublisherFilter`, `ScopeBar({value,onChange})`, `AccentRail({label,items,onPick,onPeek,accent,tagline})`, `PortraitCard onDark`, `SEARCH_NAVY` used consistently across tasks.
- **Known risk carried from spec:** custom font in native large title (Task 6 note), `setOptions` typing for `headerSearchBarOptions` (Task 7 Step 2 fallback), web nesting (Task 8 Step 2).
```
