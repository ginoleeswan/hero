# Compare Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a side-by-side hero vs hero stat comparison screen accessible from any character detail page, with a shareable URL on web and a share sheet on native.

**Architecture:** Pure comparison logic lives in `src/lib/compare.ts` (tested in isolation). A hero picker screen (`app/compare/[id1]/pick`) reuses the existing search infrastructure. The compare screen (`app/compare/[id1]/[id2]`) loads both heroes in parallel from Supabase (with API fallback) and renders a stat battle UI with a natural-language verdict. Each screen has a `.web.tsx` twin for platform-appropriate styling — same pattern as `app/character/[id].tsx` vs `app/character/[id].web.tsx`.

**Tech Stack:** expo-router 4 (file-based routing), `fetchHeroStats` + `getHeroById` + `heroRowToCharacterData` from existing lib, `react-native`'s `Share` API, `expo-image`, `COLORS` palette, `Flame-Regular` / `Nunito_700Bold` fonts.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/compare.ts` | Pure stat comparison logic + verdict string |
| Create | `__tests__/lib/compare.test.ts` | Unit tests for compare logic |
| Create | `app/compare/[id1]/pick.tsx` | Native hero picker screen |
| Create | `app/compare/[id1]/pick.web.tsx` | Web hero picker screen |
| Create | `app/compare/[id1]/[id2].tsx` | Native compare screen |
| Create | `app/compare/[id1]/[id2].web.tsx` | Web compare screen |
| Modify | `app/character/[id].tsx` | Add Compare strip at bottom (native) |
| Modify | `app/character/[id].web.tsx` | Add Compare button to header row (web) |

---

## Task 1: Comparison logic + tests

**Files:**
- Create: `src/lib/compare.ts`
- Create: `__tests__/lib/compare.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/compare.test.ts
import { compareStats } from '../../src/lib/compare';

const statsA = { intelligence: '88', strength: '55', speed: '67', durability: '75', power: '74', combat: '85' };
const statsB = { intelligence: '56', strength: '26', speed: '27', durability: '44', power: '35', combat: '76' };

describe('compareStats', () => {
  it('returns a result with 6 stat rows', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.stats).toHaveLength(6);
  });

  it('correctly identifies the winner per stat', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.stats[0].winner).toBe('A'); // intelligence 88 vs 56
    expect(result.stats[5].winner).toBe('A'); // combat 85 vs 76
  });

  it('correctly counts wins', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.winsA).toBe(6);
    expect(result.winsB).toBe(0);
  });

  it('builds a verdict string using the winner name', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.verdict).toContain('Spider-Man');
  });

  it('returns an even verdict on equal stats', () => {
    const equal = { intelligence: '50', strength: '50', speed: '50', durability: '50', power: '50', combat: '50' };
    const result = compareStats('A', equal, 'B', equal);
    expect(result.verdict).toBe('These two are evenly matched');
  });

  it('treats missing/null stats as 0', () => {
    const empty = {};
    const result = compareStats('A', empty as Record<string, string>, 'B', statsA);
    expect(result.winsB).toBe(6);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun run test:ci -- --testPathPattern=compare
```

Expected: 6 failures — `compareStats` is not defined.

- [ ] **Step 3: Implement `src/lib/compare.ts`**

```typescript
import { COLORS } from '../constants/colors';

export interface StatResult {
  key: string;
  label: string;
  color: string;
  valueA: number;
  valueB: number;
  winner: 'A' | 'B' | 'tie';
}

export interface CompareResult {
  stats: StatResult[];
  winsA: number;
  winsB: number;
  verdict: string;
}

const STAT_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength',     label: 'Strength',     color: COLORS.red },
  { key: 'speed',        label: 'Speed',         color: COLORS.yellow },
  { key: 'durability',   label: 'Durability',    color: COLORS.green },
  { key: 'power',        label: 'Power',         color: COLORS.orange },
  { key: 'combat',       label: 'Combat',        color: COLORS.brown },
];

export function compareStats(
  nameA: string,
  powerstatsA: Record<string, string>,
  nameB: string,
  powerstatsB: Record<string, string>,
): CompareResult {
  const stats: StatResult[] = STAT_CONFIG.map(({ key, label, color }) => {
    const valueA = parseInt(powerstatsA[key] ?? '0', 10) || 0;
    const valueB = parseInt(powerstatsB[key] ?? '0', 10) || 0;
    const winner: 'A' | 'B' | 'tie' = valueA > valueB ? 'A' : valueB > valueA ? 'B' : 'tie';
    return { key, label, color, valueA, valueB, winner };
  });

  const winsA = stats.filter((s) => s.winner === 'A').length;
  const winsB = stats.filter((s) => s.winner === 'B').length;

  const verdict =
    winsA > winsB
      ? `${nameA} has the edge on ${winsA} of 6 stats`
      : winsB > winsA
      ? `${nameB} has the edge on ${winsB} of 6 stats`
      : 'These two are evenly matched';

  return { stats, winsA, winsB, verdict };
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
bun run test:ci -- --testPathPattern=compare
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compare.ts __tests__/lib/compare.test.ts
git commit -m "feat(compare): add stat comparison logic + tests"
```

---

## Task 2: Native hero picker screen

**Files:**
- Create: `app/compare/[id1]/pick.tsx`

The picker loads heroes via `searchHeroes` on mount (same pattern as `search.tsx`), debounces the query, and on tap navigates to the compare screen. The route param `id1` is the base hero's ID. The base hero name is passed as a search param `name` from the character detail screen.

- [ ] **Step 1: Create `app/compare/[id1]/pick.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchHeroes, rankResults } from '../../../src/lib/db/heroes';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';
import { heroImageSource } from '../../../src/constants/heroImages';
import { COLORS } from '../../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - 12 * 3) / 2;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function PickOpponentScreen() {
  const { id1, name } = useLocalSearchParams<{ id1: string; name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [all, setAll] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 80)
    : all.slice(0, 80);

  const handlePick = (item: HeroSearchResult) => {
    router.replace(`/compare/${id1}/${item.id}`);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.beige} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Who does {name ?? 'this hero'} face?
        </Text>
      </View>

      {/* Search input */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="rgba(245,235,220,0.4)" style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Hero or villain name…"
          placeholderTextColor="rgba(245,235,220,0.28)"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 16 }]}
          renderItem={({ item }) => {
            const source = heroImageSource(item.id, item.image_url, item.portrait_url);
            return (
              <TouchableOpacity
                onPress={() => handlePick(item)}
                activeOpacity={0.82}
                style={[styles.card, { width: CARD_SIZE, height: Math.round(CARD_SIZE * 1.48) }]}
              >
                <Image
                  source={source}
                  contentFit="cover"
                  contentPosition="top"
                  style={StyleSheet.absoluteFill}
                  placeholder={COLORS.navy}
                  transition={150}
                />
                <View style={styles.cardOverlay} />
                <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
  },
  grid: { paddingHorizontal: 12, gap: 8 },
  row: { gap: 8, marginBottom: 0 },
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    marginBottom: 8,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,45,51,0.45)',
    backgroundImage: undefined,
  },
  cardName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 17,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add 'app/compare/[id1]/pick.tsx'
git commit -m "feat(compare): native hero picker screen"
```

---

## Task 3: Web hero picker screen

**Files:**
- Create: `app/compare/[id1]/pick.web.tsx`

Same logic as native picker but uses web styling patterns (CSS grid, hover states) consistent with `search.web.tsx`.

- [ ] **Step 1: Create `app/compare/[id1]/pick.web.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { searchHeroes, rankResults } from '../../../src/lib/db/heroes';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';
import { heroImageSource } from '../../../src/constants/heroImages';
import { COLORS } from '../../../src/constants/colors';

const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
  gridAutoRows: '200px',
  gap: 10,
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function WebPickOpponentScreen() {
  const { id1, name } = useLocalSearchParams<{ id1: string; name: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [all, setAll] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 120)
    : all.slice(0, 120);

  return (
    <View style={styles.root}>
      {/* Header bar */}
      <View style={styles.header as object}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
            }
          >
            <Ionicons name="arrow-back" size={16} color={COLORS.beige} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Who does {name ?? 'this hero'} face?</Text>
          <View style={styles.searchWrap as object}>
            <TextInput
              ref={inputRef}
              style={styles.input as object}
              placeholder="Hero or villain name…"
              placeholderTextColor="rgba(245,235,220,0.28)"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(245,235,220,0.4)" />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={resultsGrid as object}>
            {displayed.map((item) => {
              const source = heroImageSource(item.id, item.image_url, item.portrait_url);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.replace(`/compare/${id1}/${item.id}`)}
                  style={({ hovered }: { hovered?: boolean }) =>
                    [card.wrap, hovered && (card.wrapHover as object)] as object
                  }
                >
                  <Image
                    source={source}
                    contentFit="cover"
                    contentPosition="top center"
                    style={StyleSheet.absoluteFill}
                    placeholder={COLORS.navy}
                    transition={150}
                  />
                  <View style={card.overlay as object} />
                  <Text style={card.name as object} numberOfLines={2}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'sticky',
    top: 64,
    zIndex: 50,
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
    paddingVertical: 14,
  } as object,
  headerInner: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  backBtnHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.65)',
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    flexShrink: 0,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(245,235,220,0.2)',
    paddingBottom: 4,
    gap: 8,
  } as object,
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,
  scroll: { flex: 1 },
  content: {
    padding: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 80,
  },
});

const card = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.9) 0%, rgba(29,45,51,0.1) 55%, transparent 100%)',
  } as object,
  name: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 17,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});
```

- [ ] **Step 2: Commit**

```bash
git add 'app/compare/[id1]/pick.web.tsx'
git commit -m "feat(compare): web hero picker screen"
```

---

## Task 4: Native compare screen

**Files:**
- Create: `app/compare/[id1]/[id2].tsx`

Loads both heroes in parallel (Supabase first, API fallback). Renders full-bleed portrait cards side by side at the top, then a scrollable stat battle column below. Share button uses React Native's `Share` API.

- [ ] **Step 1: Create `app/compare/[id1]/[id2].tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHeroById, heroRowToCharacterData } from '../../../src/lib/db/heroes';
import { fetchHeroStats } from '../../../src/lib/api';
import { heroImageSource } from '../../../src/constants/heroImages';
import { compareStats } from '../../../src/lib/compare';
import type { StatResult } from '../../../src/lib/compare';
import type { HeroStats } from '../../../src/types';
import { COLORS } from '../../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTRAIT_HEIGHT = Math.round(SCREEN_WIDTH * 0.72);

async function loadHeroStats(id: string): Promise<HeroStats> {
  const row = await getHeroById(id);
  if (row) return heroRowToCharacterData(row).stats;
  return fetchHeroStats(id);
}

function StatBattleRow({ stat }: { stat: StatResult }) {
  const aWins = stat.winner === 'A';
  const bWins = stat.winner === 'B';
  const winColor = stat.color;
  const dimColor = 'rgba(41,60,67,0.18)';

  return (
    <View style={battle.row}>
      {/* Left value + bar */}
      <View style={battle.side}>
        <Text style={[battle.val, aWins && battle.valWin]}>{stat.valueA}</Text>
        <View style={battle.track}>
          <View
            style={[
              battle.barLeft,
              { width: `${stat.valueA}%`, backgroundColor: aWins ? winColor : dimColor },
            ]}
          />
        </View>
      </View>

      {/* Stat label in center */}
      <Text style={battle.label}>{stat.label}</Text>

      {/* Right bar + value */}
      <View style={[battle.side, battle.sideRight]}>
        <View style={battle.track}>
          <View
            style={[
              battle.barRight,
              { width: `${stat.valueB}%`, backgroundColor: bWins ? winColor : dimColor },
            ]}
          />
        </View>
        <Text style={[battle.val, bWins && battle.valWin]}>{stat.valueB}</Text>
      </View>
    </View>
  );
}

export default function NativeCompareScreen() {
  const { id1, id2 } = useLocalSearchParams<{ id1: string; id2: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [statsA, setStatsA] = useState<HeroStats | null>(null);
  const [statsB, setStatsB] = useState<HeroStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadHeroStats(id1), loadHeroStats(id2)])
      .then(([a, b]) => { setStatsA(a); setStatsB(b); })
      .catch(() => setError('Could not load hero data.'));
  }, [id1, id2]);

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!statsA || !statsB) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  const result = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
  const imageA = heroImageSource(id1, statsA.image.url);
  const imageB = heroImageSource(id2, statsB.image.url);

  const handleShare = () => {
    Share.share({
      message: `${statsA.name} vs ${statsB.name} — ${result.verdict}. Check it out on Hero app!`,
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Back + Share header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.beige} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>vs</Text>
        <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.beige} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Portrait cards — side by side, full width */}
        <View style={styles.portraits}>
          <View style={[styles.portraitWrap, { height: PORTRAIT_HEIGHT }]}>
            <Image source={imageA} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
            <View style={styles.portraitOverlay} />
            <Text style={styles.portraitName} numberOfLines={2}>{statsA.name}</Text>
          </View>
          <View style={[styles.portraitWrap, { height: PORTRAIT_HEIGHT }]}>
            <Image source={imageB} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
            <View style={styles.portraitOverlay} />
            <Text style={[styles.portraitName, styles.portraitNameRight]} numberOfLines={2}>{statsB.name}</Text>
          </View>
        </View>

        {/* Verdict */}
        <View style={styles.verdictWrap}>
          <Text style={styles.verdict}>{result.verdict}</Text>
        </View>

        {/* Stat battle */}
        <View style={styles.battleWrap}>
          {result.stats.map((stat) => (
            <StatBattleRow key={stat.key} stat={stat} />
          ))}
        </View>

        {/* Compare another */}
        <TouchableOpacity
          onPress={() => router.push(`/compare/${id1}/pick?name=${encodeURIComponent(statsA.name)}`)}
          activeOpacity={0.8}
          style={styles.compareAnotherBtn}
        >
          <Text style={styles.compareAnotherText}>Compare {statsA.name} with someone else →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: { padding: 6 },
  topBarTitle: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  portraits: { flexDirection: 'row', height: PORTRAIT_HEIGHT },
  portraitWrap: { flex: 1, overflow: 'hidden' },
  portraitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,45,51,0.28)',
  },
  portraitName: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 6,
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    lineHeight: 21,
  },
  portraitNameRight: { left: 6, right: 12, textAlign: 'right' },
  verdictWrap: {
    backgroundColor: COLORS.navy,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginBottom: 0,
  },
  verdict: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 26,
  },
  battleWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  compareAnotherBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  compareAnotherText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.65)',
    letterSpacing: 0.3,
  },
});

const battle = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideRight: { flexDirection: 'row-reverse' },
  val: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(41,60,67,0.35)',
    width: 26,
    textAlign: 'center',
    flexShrink: 0,
  },
  valWin: { color: COLORS.navy },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barLeft: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  barRight: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: 80,
    textAlign: 'center',
    flexShrink: 0,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add 'app/compare/[id1]/[id2].tsx'
git commit -m "feat(compare): native compare screen"
```

---

## Task 5: Web compare screen

**Files:**
- Create: `app/compare/[id1]/[id2].web.tsx`

Desktop: two portrait panels flanking a center stat column (magazine spread). Mobile (< 768px): stacked layout. Share via `navigator.share` with clipboard fallback.

- [ ] **Step 1: Create `app/compare/[id1]/[id2].web.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getHeroById, heroRowToCharacterData } from '../../../src/lib/db/heroes';
import { fetchHeroStats } from '../../../src/lib/api';
import { heroImageSource } from '../../../src/constants/heroImages';
import { compareStats } from '../../../src/lib/compare';
import type { StatResult } from '../../../src/lib/compare';
import type { HeroStats } from '../../../src/types';
import { COLORS } from '../../../src/constants/colors';

async function loadHeroStats(id: string): Promise<HeroStats> {
  const row = await getHeroById(id);
  if (row) return heroRowToCharacterData(row).stats;
  return fetchHeroStats(id);
}

function StatBattleRow({ stat, isDesktop }: { stat: StatResult; isDesktop: boolean }) {
  const aWins = stat.winner === 'A';
  const bWins = stat.winner === 'B';
  const winColor = stat.color;
  const dimColor = 'rgba(245,235,220,0.12)';

  return (
    <View style={wb.row}>
      <View style={wb.side}>
        <Text style={[wb.val, aWins && wb.valWin]}>{stat.valueA}</Text>
        <View style={wb.track}>
          <View
            style={[wb.barLeft, { width: `${stat.valueA}%`, backgroundColor: aWins ? winColor : dimColor }] as object}
          />
        </View>
      </View>

      <Text style={[wb.label, isDesktop && (wb.labelDesktop as object)] as object}>{stat.label}</Text>

      <View style={[wb.side, wb.sideRight]}>
        <View style={wb.track}>
          <View
            style={[wb.barRight, { width: `${stat.valueB}%`, backgroundColor: bWins ? winColor : dimColor }] as object}
          />
        </View>
        <Text style={[wb.val, bWins && wb.valWin]}>{stat.valueB}</Text>
      </View>
    </View>
  );
}

export default function WebCompareScreen() {
  const { id1, id2 } = useLocalSearchParams<{ id1: string; id2: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [statsA, setStatsA] = useState<HeroStats | null>(null);
  const [statsB, setStatsB] = useState<HeroStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([loadHeroStats(id1), loadHeroStats(id2)])
      .then(([a, b]) => { setStatsA(a); setStatsB(b); })
      .catch(() => setError('Could not load hero data.'));
  }, [id1, id2]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!statsA || !statsB) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  const result = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
  const imageA = heroImageSource(id1, statsA.image.url);
  const imageB = heroImageSource(id2, statsB.image.url);

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = { title: `${statsA.name} vs ${statsB.name}`, url };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
      await navigator.share(shareData);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const portraitHeight = isDesktop ? 520 : 280;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contentOuter}>

      {/* Sub-header */}
      <View style={styles.subHeader as object}>
        <View style={styles.subHeaderInner}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
            }
          >
            <Ionicons name="arrow-back" size={15} color={COLORS.beige} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.subTitle}>{statsA.name} <Text style={styles.vs}>vs</Text> {statsB.name}</Text>

          <Pressable
            onPress={handleShare}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.shareBtn, hovered && (styles.shareBtnHover as object)] as object
            }
          >
            <Ionicons name="share-outline" size={15} color={COLORS.beige} />
            <Text style={styles.shareText}>{copied ? 'Copied!' : 'Share'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {/* Desktop: side-by-side portrait + center stat column */}
        {isDesktop ? (
          <View style={styles.desktopLayout as object}>
            {/* Hero A portrait */}
            <View style={[styles.portraitWrap, { height: portraitHeight }]}>
              <Image source={imageA} contentFit="cover" contentPosition="top" style={{ width: '100%', height: '100%' } as object} />
              <View style={styles.portraitOverlay as object} />
              <View style={styles.portraitLabel}>
                {statsA.biography.publisher ? (
                  <Text style={styles.publisher}>{statsA.biography.publisher}</Text>
                ) : null}
                <Text style={styles.heroNameLarge as object}>{statsA.name}</Text>
                <Text style={styles.winsLabel}>{result.winsA} stat{result.winsA !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            {/* Center: stat battle */}
            <View style={styles.centerCol}>
              <View style={styles.verdictCard}>
                <Text style={styles.verdictText}>{result.verdict}</Text>
              </View>
              <View style={styles.battleRows}>
                {result.stats.map((stat) => (
                  <StatBattleRow key={stat.key} stat={stat} isDesktop={isDesktop} />
                ))}
              </View>
              <Pressable
                onPress={() => router.push(`/compare/${id1}/pick?name=${encodeURIComponent(statsA.name)}`)}
                style={({ hovered }: { hovered?: boolean }) =>
                  [styles.compareAnotherBtn, hovered && (styles.compareAnotherHover as object)] as object
                }
              >
                <Text style={styles.compareAnotherText}>Compare someone else →</Text>
              </Pressable>
            </View>

            {/* Hero B portrait */}
            <View style={[styles.portraitWrap, { height: portraitHeight }]}>
              <Image source={imageB} contentFit="cover" contentPosition="top" style={{ width: '100%', height: '100%' } as object} />
              <View style={styles.portraitOverlay as object} />
              <View style={[styles.portraitLabel, styles.portraitLabelRight]}>
                {statsB.biography.publisher ? (
                  <Text style={styles.publisher}>{statsB.biography.publisher}</Text>
                ) : null}
                <Text style={[styles.heroNameLarge, styles.textRight] as object}>{statsB.name}</Text>
                <Text style={[styles.winsLabel, styles.textRight]}>{result.winsB} stat{result.winsB !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        ) : (
          /* Mobile: stacked */
          <View>
            <View style={styles.mobilePortraits}>
              <View style={[styles.mobilePortraitWrap, { height: portraitHeight }]}>
                <Image source={imageA} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
                <View style={styles.portraitOverlay as object} />
                <Text style={styles.mobilePortraitName}>{statsA.name}</Text>
              </View>
              <View style={[styles.mobilePortraitWrap, { height: portraitHeight }]}>
                <Image source={imageB} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
                <View style={styles.portraitOverlay as object} />
                <Text style={[styles.mobilePortraitName, styles.textRight]}>{statsB.name}</Text>
              </View>
            </View>
            <View style={styles.verdictCard}>
              <Text style={styles.verdictText}>{result.verdict}</Text>
            </View>
            <View style={styles.battleRows}>
              {result.stats.map((stat) => (
                <StatBattleRow key={stat.key} stat={stat} isDesktop={false} />
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  contentOuter: { paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },

  subHeader: {
    position: 'sticky',
    top: 64,
    zIndex: 50,
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
    paddingVertical: 12,
  } as object,
  subHeaderInner: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    cursor: 'pointer',
  } as object,
  backBtnHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  backText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(245,235,220,0.65)' },
  subTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  vs: { color: COLORS.orange },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    cursor: 'pointer',
  } as object,
  shareBtnHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  shareText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(245,235,220,0.65)' },

  body: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  } as object,

  // Portrait panels
  portraitWrap: {
    flex: 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
  },
  portraitOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.95) 0%, rgba(29,45,51,0.3) 50%, transparent 100%)',
  } as object,
  portraitLabel: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  portraitLabelRight: { alignItems: 'flex-end' },
  publisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroNameLarge: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.beige,
    lineHeight: 34,
    marginBottom: 6,
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
  } as object,
  winsLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Center column
  centerCol: { flex: 2, gap: 16, minWidth: 220 },
  verdictCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 20,
    marginBottom: 4,
  },
  verdictText: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 24,
  },
  battleRows: { gap: 8 },
  compareAnotherBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.2)',
    alignItems: 'center',
    cursor: 'pointer',
    marginTop: 4,
  } as object,
  compareAnotherHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  compareAnotherText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    opacity: 0.5,
    letterSpacing: 0.3,
  },

  // Mobile portraits
  mobilePortraits: { flexDirection: 'row', height: 280, gap: 6, marginBottom: 16 },
  mobilePortraitWrap: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.navy },
  mobilePortraitName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 6,
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
    lineHeight: 19,
  },
  textRight: { textAlign: 'right' },
});

const wb = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideRight: { flexDirection: 'row-reverse' },
  val: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(41,60,67,0.3)',
    width: 24,
    textAlign: 'center',
    flexShrink: 0,
  },
  valWin: { color: COLORS.navy },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barLeft: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    borderRadius: 4,
  },
  barRight: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    borderRadius: 4,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    width: 68,
    textAlign: 'center',
    flexShrink: 0,
  },
  labelDesktop: { width: 90, fontSize: 10 } as object,
});
```

- [ ] **Step 2: Commit**

```bash
git add 'app/compare/[id1]/[id2].web.tsx'
git commit -m "feat(compare): web compare screen — desktop split + mobile stacked"
```

---

## Task 6: Add Compare entry point to native character detail

**Files:**
- Modify: `app/character/[id].tsx`

Add a fixed Compare strip above the bottom safe area, outside the `ScrollView`. Add `paddingBottom` offset to the scroll content so it clears the strip.

- [ ] **Step 1: Read the bottom of the component structure in `app/character/[id].tsx`**

Find the closing of `<Animated.ScrollView>` and the outer `<View style={styles.container}>`. The strip goes between them.

- [ ] **Step 2: Add the Compare strip**

In `app/character/[id].tsx`, find the closing of `Animated.ScrollView` and add the strip before the outer `</View>`:

```tsx
{/* Compare strip — fixed above safe-area bottom */}
{data && (
  <View style={[styles.compareStrip, { paddingBottom: insets.bottom || 12 }]}>
    <TouchableOpacity
      onPress={() =>
        router.push(
          `/compare/${id}/pick?name=${encodeURIComponent(data.stats.name)}`
        )
      }
      activeOpacity={0.85}
      style={styles.compareStripBtn}
    >
      <Ionicons name="git-compare-outline" size={18} color={COLORS.beige} />
      <Text style={styles.compareStripText}>Compare {data.stats.name}</Text>
    </TouchableOpacity>
  </View>
)}
```

Also add `paddingBottom: 80` to the `Animated.ScrollView`'s `contentContainerStyle` so the last section isn't hidden behind the strip. The existing `contentContainerStyle` is:
```tsx
contentContainerStyle={{
  paddingTop: HERO_IMAGE_HEIGHT - 160,
  paddingBottom: insets.bottom + 32,
}}
```
Change it to:
```tsx
contentContainerStyle={{
  paddingTop: HERO_IMAGE_HEIGHT - 160,
  paddingBottom: insets.bottom + 96,
}}
```

Add styles:
```tsx
compareStrip: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: COLORS.navy,
  paddingTop: 12,
  paddingHorizontal: 16,
},
compareStripBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  backgroundColor: 'rgba(245,235,220,0.08)',
  borderRadius: 10,
  paddingVertical: 14,
},
compareStripText: {
  fontFamily: 'Nunito_700Bold',
  fontSize: 14,
  color: COLORS.beige,
  letterSpacing: 0.3,
},
```

- [ ] **Step 3: Commit**

```bash
git add 'app/character/[id].tsx'
git commit -m "feat(compare): add Compare strip to native character detail"
```

---

## Task 7: Add Compare entry point to web character detail

**Files:**
- Modify: `app/character/[id].web.tsx`

Add a "Compare" button in the `headerTopRow` alongside the existing back and favourite buttons. On click, navigate to the picker.

- [ ] **Step 1: Add Compare button to `app/character/[id].web.tsx`**

In the `headerTopRow` View (which already has the back button and favourite button), add a Compare button between the fav and the right edge:

```tsx
<Pressable
  onPress={() =>
    router.push(`/compare/${id}/pick?name=${encodeURIComponent(stats.name)}`)
  }
  style={({ hovered }: { hovered?: boolean }) =>
    [styles.compareBtn, hovered && (styles.compareBtnHover as object)] as object
  }
>
  <Ionicons name="git-compare-outline" size={15} color={COLORS.beige} />
  <Text style={styles.compareBtnText}>Compare</Text>
</Pressable>
```

Add styles:
```tsx
compareBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'rgba(245,235,220,0.18)',
  cursor: 'pointer',
} as object,
compareBtnHover: {
  backgroundColor: 'rgba(245,235,220,0.08)',
  borderColor: 'rgba(245,235,220,0.3)',
} as object,
compareBtnText: {
  fontFamily: 'Nunito_700Bold',
  fontSize: 13,
  color: 'rgba(245,235,220,0.75)',
},
```

- [ ] **Step 2: Commit**

```bash
git add 'app/character/[id].web.tsx'
git commit -m "feat(compare): add Compare button to web character detail header"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/compare/[id1]/[id2]` shareable URL route — Task 4 + 5
- ✅ Hero picker from character detail — Task 6 + 7
- ✅ Stat battle UI (bars growing from center) — Task 4 + 5
- ✅ Natural-language verdict — Task 1
- ✅ Share button (native Share.share / web navigator.share + clipboard) — Task 4 + 5
- ✅ "Compare another" affordance on compare screen — Task 4 + 5
- ✅ Desktop magazine spread layout — Task 5
- ✅ Mobile stacked layout — Task 4 + 5

**Type consistency check:**
- `StatResult` and `CompareResult` defined in Task 1, imported by Task 4 + 5 — ✅
- `loadHeroStats` is defined identically in both `[id1]/[id2].tsx` and `[id1]/[id2].web.tsx` — ✅ (intentional duplication to avoid shared state between platform files)
- `heroImageSource(id, statsA.image.url)` matches the signature `(id: string | number, imageUrl?: string | null, portraitUrl?: string | null)` — ✅

**Placeholder scan:** No TBDs, TODOs, or vague steps found.
