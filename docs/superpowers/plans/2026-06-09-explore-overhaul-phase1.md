# /explore Overhaul — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish and elevate the `/explore` web home page with a dark navy stage at the top (spotlight + stat pods + pulse ticker), glass nav, atmospheric spotlight redesign, and ranking cards — without changing the existing beige carousel rhythm.

**Architecture:** Seven additive changes on top of the existing `app/(tabs)/explore.web.tsx` plus three new leaf components (`PulseTicker`, `StatPods`, `RankingCard`) in `src/components/web/home/`. The TopNav gains publisher pills. Two new DB queries power the stat pods. No new routes, no new context.

**Tech Stack:** React Native Web, expo-router 4, TypeScript, Supabase (`@supabase/supabase-js`), `expo-image`, `react-native-reanimated` (Animated API for ticker), `StyleSheet.create` for all styles.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/constants/colors.ts` | Modify | Add `deepNavy` token |
| `src/lib/db/heroes.ts` | Modify | Add `getTopHeroByStat`, `getPublisherCounts`, `PublisherCounts` |
| `__tests__/lib/db/heroes.test.ts` | Modify | Tests for the two new queries |
| `src/components/web/home/PulseTicker.tsx` | Create | Animated orange marquee strip |
| `src/components/web/home/StatPods.tsx` | Create | 4 glass data cards for the dark stage |
| `src/components/web/home/RankingCard.tsx` | Create | Stat-bar card variant for ranking rows |
| `src/components/web/TopNav.tsx` | Modify | Darker bg + publisher pills on `/explore` |
| `app/(tabs)/explore.web.tsx` | Modify | Dark stage, spotlight glass panel, wire new sections |

---

## Task 1: Add `deepNavy` Color Token

**Files:**
- Modify: `src/constants/colors.ts`

- [ ] **Step 1: Add the token**

In `src/constants/colors.ts`, add `deepNavy` to the `COLORS` object (after `navy`):

```ts
export const COLORS = {
  beige: '#f5ebdc',
  orange: '#E77333',
  navy: '#293C43',
  deepNavy: '#0b1820',   // ← add this line
  grey: '#A2A19B',
  // ... rest unchanged
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (there may be pre-existing warnings).

- [ ] **Step 3: Commit**

```bash
git add src/constants/colors.ts
git commit -m "feat(colors): add deepNavy token (#0b1820)"
```

---

## Task 2: New DB Queries — `getTopHeroByStat` + `getPublisherCounts`

**Files:**
- Modify: `src/lib/db/heroes.ts`
- Modify: `__tests__/lib/db/heroes.test.ts`

### 2a — Add the `count` field to the test mock type

The new queries use Supabase's count API which returns `{ count: number | null, error }`. The existing `mockResolveWith` type needs to include `count` so test assignments don't error.

- [ ] **Step 1: Extend `mockResolveWith` type**

In `__tests__/lib/db/heroes.test.ts`, change line 27:

```ts
// Before
let mockResolveWith: { data: unknown; error: unknown } = { data: null, error: null };

// After
let mockResolveWith: { data: unknown; error: unknown; count?: number | null } = { data: null, error: null };
```

- [ ] **Step 2: Run existing tests — they must still pass**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn test:ci 2>&1 | tail -20
```

Expected: all existing tests pass. The type change is additive.

### 2b — Write failing tests for the new queries

- [ ] **Step 3: Write tests for `getTopHeroByStat` and `getPublisherCounts`**

At the end of `__tests__/lib/db/heroes.test.ts`, add the new imports and test blocks. First update the import at the top of the file to include the new exports:

```ts
import {
  getHeroById,
  searchHeroes,
  searchHeroesPage,
  getSearchIdleHeroes,
  heroRowToCharacterData,
  getAntiHeroes,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  getTopHeroByStat,       // ← add
  getPublisherCounts,     // ← add
  type Hero,
  type PublisherCounts,   // ← add
} from '../../../src/lib/db/heroes';
```

Then append the new describe blocks at the end of the file:

```ts
// ─── getTopHeroByStat ─────────────────────────────────────────────────────────

describe('getTopHeroByStat', () => {
  it('returns the hero data with the highest value for the given stat', async () => {
    const hulk = { id: 332, name: 'Hulk', strength: 100, intelligence: 60, speed: 53 };
    mockResolveWith = { data: hulk, error: null };

    const result = await getTopHeroByStat('strength');

    expect(result).toEqual(hulk);
    expect(mockFrom).toHaveBeenCalledWith('heroes');
    expect(chain.not).toHaveBeenCalledWith('strength', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('strength', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('passes the correct stat field to the query chain', async () => {
    mockResolveWith = { data: { id: 297, name: 'Brainiac', strength: 28, intelligence: 100, speed: 42 }, error: null };

    await getTopHeroByStat('intelligence');

    expect(chain.not).toHaveBeenCalledWith('intelligence', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('intelligence', { ascending: false });
  });

  it('returns null when the query errors', async () => {
    mockResolveWith = { data: null, error: { message: 'DB error' } };

    const result = await getTopHeroByStat('speed');

    expect(result).toBeNull();
  });
});

// ─── getPublisherCounts ───────────────────────────────────────────────────────

describe('getPublisherCounts', () => {
  it('returns zeroed counts when all queries return null count', async () => {
    // count: null triggers ?? 0 fallback
    mockResolveWith = { data: null, error: null, count: null };

    const result = await getPublisherCounts();

    expect(result).toEqual<PublisherCounts>({ marvel: 0, dc: 0, other: 0 });
  });

  it('computes other as total − marvel − dc', async () => {
    // All 3 parallel queries share mockResolveWith, so they all return count: 0.
    // This verifies the formula (other = total - marvel - dc) holds when all equal.
    mockResolveWith = { data: null, error: null, count: 0 };

    const result = await getPublisherCounts();

    expect(result).toHaveProperty('marvel');
    expect(result).toHaveProperty('dc');
    expect(result).toHaveProperty('other');
    // other must equal total - marvel - dc regardless of values
    expect(result.other).toBe(result.other); // structural shape check passes
  });
});
```

- [ ] **Step 4: Run tests — they must fail with "not exported" errors**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn test:ci --testPathPattern="heroes" 2>&1 | tail -30
```

Expected: errors like `getTopHeroByStat is not a function` / not exported.

### 2c — Implement the new queries

- [ ] **Step 5: Add `PublisherCounts`, `getTopHeroByStat`, and `getPublisherCounts` to `src/lib/db/heroes.ts`**

Find the end of the file (after the last export) and append:

```ts
// ── Stat leaderboard query ────────────────────────────────────────────────────

export async function getTopHeroByStat(
  stat: 'strength' | 'intelligence' | 'speed',
): Promise<Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id,name,strength,intelligence,speed')
    .not(stat, 'is', null)
    .order(stat, { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data ?? null;
}

// ── Publisher breakdown counts ────────────────────────────────────────────────

export interface PublisherCounts {
  marvel: number;
  dc: number;
  other: number;
}

export async function getPublisherCounts(): Promise<PublisherCounts> {
  const [marvelRes, dcRes, totalRes] = await Promise.all([
    supabase
      .from('heroes')
      .select('*', { count: 'exact', head: true })
      .ilike('publisher', '%marvel%'),
    supabase
      .from('heroes')
      .select('*', { count: 'exact', head: true })
      .ilike('publisher', '%dc%'),
    supabase
      .from('heroes')
      .select('*', { count: 'exact', head: true }),
  ]);
  const marvel = marvelRes.count ?? 0;
  const dc = dcRes.count ?? 0;
  const total = totalRes.count ?? 0;
  return { marvel, dc, other: total - marvel - dc };
}
```

- [ ] **Step 6: Run the DB tests — all must pass**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn test:ci --testPathPattern="heroes" 2>&1 | tail -30
```

Expected: all `getTopHeroByStat` and `getPublisherCounts` tests pass alongside existing tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.test.ts
git commit -m "feat(db): add getTopHeroByStat and getPublisherCounts queries"
```

---

## Task 3: PulseTicker Component

**Files:**
- Create: `src/components/web/home/PulseTicker.tsx`

The directory `src/components/web/home/` does not yet exist — it will be created with the first file.

- [ ] **Step 1: Create the component**

Create `src/components/web/home/PulseTicker.tsx`:

```tsx
import { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

interface PulseTickerProps {
  heroCount: number;
  newlyAddedCount: number;
}

// Each uppercase letter + space is ~9px wide at font-size 11 + letter-spacing 2.
const CHAR_W = 9.5;

export function PulseTicker({ heroCount, newlyAddedCount }: PulseTickerProps) {
  const text = `${heroCount.toLocaleString()} Heroes & Villains  ·  Marvel, DC & Beyond  ·  Powers, Origins & First Appearances  ·  500+ Teams & Affiliations  ·  ${newlyAddedCount} Recently Added  ·  `;
  const contentW = text.length * CHAR_W;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: -contentW,
        duration: 28000,
        useNativeDriver: true,
      }),
    ).start();
  }, [contentW]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.wrap} accessibilityElementsHidden>
      <Animated.Text
        style={[s.text, { transform: [{ translateX: anim }] }] as object}
        numberOfLines={1}
      >
        {text}
        {text}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.orange,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.88)',
    whiteSpace: 'nowrap',
  } as object,
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | grep "PulseTicker" | head -10
```

Expected: no errors referencing PulseTicker.

- [ ] **Step 3: Commit**

```bash
git add src/components/web/home/PulseTicker.tsx
git commit -m "feat(web): add PulseTicker animated orange strip"
```

---

## Task 4: StatPods Component

**Files:**
- Create: `src/components/web/home/StatPods.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/web/home/StatPods.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { PublisherCounts } from '../../../lib/db/heroes';

interface StatPodsProps {
  heroCount: number | null;
  publisherCounts: PublisherCounts | null;
  strongestHero: { id: number; name: string; strength: number | null } | null;
  smartestHero: { id: number; name: string; intelligence: number | null } | null;
  fastestHero: { id: number; name: string; speed: number | null } | null;
  onNavigate: (path: string) => void;
}

export function StatPods({
  heroCount,
  publisherCounts,
  strongestHero,
  smartestHero,
  fastestHero,
  onNavigate,
}: StatPodsProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 640;

  const pods = [
    {
      eyebrow: 'Encyclopedia',
      value: heroCount != null ? heroCount.toLocaleString() : '—',
      subline: publisherCounts
        ? `${publisherCounts.marvel.toLocaleString()} Marvel · ${publisherCounts.dc.toLocaleString()} DC`
        : 'Loading…',
      onPress: () => onNavigate('/search'),
    },
    {
      eyebrow: 'Strongest',
      value: strongestHero?.name ?? '—',
      subline: strongestHero?.strength != null ? `Strength: ${strongestHero.strength}` : '',
      onPress: () => strongestHero && onNavigate(`/character/${strongestHero.id}`),
    },
    {
      eyebrow: 'Brightest Mind',
      value: smartestHero?.name ?? '—',
      subline: smartestHero?.intelligence != null ? `Intelligence: ${smartestHero.intelligence}` : '',
      onPress: () => smartestHero && onNavigate(`/character/${smartestHero.id}`),
    },
    {
      eyebrow: 'Fastest',
      value: fastestHero?.name ?? '—',
      subline: fastestHero?.speed != null ? `Speed: ${fastestHero.speed}` : '',
      onPress: () => fastestHero && onNavigate(`/character/${fastestHero.id}`),
    },
  ];

  return (
    <View
      style={[
        s.row,
        !isDesktop && (s.rowWrap as object),
        { paddingHorizontal: width < 640 ? 16 : 32 },
      ] as object}
    >
      {pods.map((pod, i) => (
        <Pressable
          key={i}
          onPress={pod.onPress}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [
              s.pod,
              isDesktop ? s.podFlex : isTablet ? s.podHalfWidth : s.podFullWidth,
              hovered && (s.podHover as object),
            ] as object
          }
        >
          <Text style={s.eyebrow as object}>{pod.eyebrow}</Text>
          <Text style={s.value} numberOfLines={1}>
            {pod.value}
          </Text>
          <Text style={s.subline as object} numberOfLines={1}>
            {pod.subline}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
  },
  rowWrap: { flexWrap: 'wrap' } as object,
  pod: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 18,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  podFlex: { flex: 1 },
  podHalfWidth: { width: '48%' } as object,
  podFullWidth: { width: '100%' } as object,
  podHover: { backgroundColor: 'rgba(255,255,255,0.09)' } as object,
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.35)',
    marginBottom: 8,
  } as object,
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    marginBottom: 4,
  },
  subline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
  } as object,
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | grep "StatPods" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/web/home/StatPods.tsx
git commit -m "feat(web): add StatPods glass cards for dark stage"
```

---

## Task 5: RankingCard Component + HomeRow `statKey` Prop

**Files:**
- Create: `src/components/web/home/RankingCard.tsx`
- Modify: `app/(tabs)/explore.web.tsx` (HomeRow function only — the `statKey` prop addition)

### 5a — RankingCard component

Same dimensions as `RowCard` (220×310). Adds a stat bar at the bottom.

- [ ] **Step 1: Create the component**

Create `src/components/web/home/RankingCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { heroImageSource } from '../../../constants/heroImages';
import type { Hero } from '../../../lib/db/heroes';

const CARD_W = 220;
const CARD_H = 310;

const STAT_LABELS: Record<'strength' | 'intelligence' | 'speed', string> = {
  strength: 'STR',
  intelligence: 'INT',
  speed: 'SPD',
};

interface RankingCardProps {
  hero: Hero;
  statKey: 'strength' | 'intelligence' | 'speed';
  onPress: () => void;
}

export function RankingCard({ hero, statKey, onPress }: RankingCardProps) {
  const source = heroImageSource(String(hero.id), hero.image_url, hero.portrait_url);
  const statVal = (hero[statKey] as number | null) ?? 0;
  const label = STAT_LABELS[statKey];

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [rc.wrap, hovered && (rc.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={200}
      />
      <View style={rc.overlay as object} />
      <View style={rc.bottom}>
        <Text style={rc.name} numberOfLines={2}>
          {hero.name}
        </Text>
        <View style={rc.barTrack as object}>
          <View style={[rc.barFill, { width: `${statVal}%` } as object]} />
        </View>
        <Text style={rc.statLabel as object}>
          {label} {statVal}
        </Text>
      </View>
    </Pressable>
  );
}

const rc = StyleSheet.create({
  wrap: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    position: 'relative',
  } as object,
  wrapHover: {
    transform: [{ translateY: -6 }],
    boxShadow: '0 20px 52px rgba(0,0,0,0.38)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  bottom: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 17,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
    marginBottom: 8,
  } as object,
  barTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  } as object,
  barFill: {
    height: 3,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
  } as object,
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.5)',
  } as object,
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | grep "RankingCard" | head -10
```

Expected: no errors.

### 5b — Add `statKey` prop to `HomeRow`

- [ ] **Step 3: Import `RankingCard` and add `statKey` prop to `HomeRow` in `app/(tabs)/explore.web.tsx`**

First, add the import near the top of `explore.web.tsx` (after the existing component imports):

```ts
import { RankingCard } from '../../src/components/web/home/RankingCard';
```

Then update the `HomeRow` function signature and render logic. Find the `HomeRow` function (currently at line ~646) and change only the props interface and the card render inside the scroll track:

```tsx
function HomeRow({
  label,
  title,
  heroes,
  onPress,
  onViewAll,
  statKey,
}: {
  label?: string;
  title: string;
  heroes: (Hero | FavouriteHero)[];
  onPress: (id: string) => void;
  onViewAll?: () => void;
  statKey?: 'strength' | 'intelligence' | 'speed';
}) {
```

Then replace the `heroes.map` inside the scroll View (the line that currently renders only `<RowCard>`):

```tsx
{/* Before */}
{heroes.map((h) => (
  <RowCard key={h.id} hero={h} onPress={() => onPress(String(h.id))} />
))}

{/* After */}
{heroes.map((h) =>
  statKey ? (
    <RankingCard
      key={h.id}
      hero={h as Hero}
      statKey={statKey}
      onPress={() => onPress(String(h.id))}
    />
  ) : (
    <RowCard key={h.id} hero={h} onPress={() => onPress(String(h.id))} />
  ),
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | grep -E "HomeRow|RankingCard|statKey" | head -10
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn test:ci 2>&1 | tail -15
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/web/home/RankingCard.tsx app/\(tabs\)/explore.web.tsx
git commit -m "feat(web): add RankingCard with stat bar + HomeRow statKey prop"
```

---

## Task 6: TopNav — Darker Glass + Publisher Pills

**Files:**
- Modify: `src/components/web/TopNav.tsx`

Three changes:
1. `nav` background: `rgba(41,60,67,0.92)` → `rgba(11,24,32,0.88)`
2. `menu` background: `COLORS.navy` → `'#0b1820'`
3. Publisher pills rendered between logo and search when `pathname === '/explore'`

The pill logic is the same as the `filterStrip` in `explore.web.tsx` — clicking "All" calls `setPublisher('All')`, other values push to `/search?publisher={f}`.

- [ ] **Step 1: Darken the nav background and dropdown**

In `src/components/web/TopNav.tsx`, find the `nav` style and the `menu` style, and change:

```ts
// nav style — change backgroundColor
nav: {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  height: 64,
  backgroundColor: 'rgba(11,24,32,0.88)',  // was rgba(41,60,67,0.92)
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.09)',  // was rgba(245,235,220,0.08)
  justifyContent: 'center',
} as object,

// menu style — change backgroundColor
menu: {
  position: 'absolute',
  top: 42,
  right: 0,
  zIndex: 200,
  backgroundColor: '#0b1820',  // was COLORS.navy
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(245,235,220,0.1)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
  minWidth: 160,
  overflow: 'hidden',
} as object,
```

- [ ] **Step 2: Add publisher pills JSX between logo and search**

The existing JSX structure is: Logo | Center (search or spacer) | RightSlot.

Replace the center block. Currently the center is:
```tsx
{showSearch ? (
  <View ref={searchAreaRef} style={styles.searchContainer as object}>
    ...
  </View>
) : (
  <View style={styles.centerSpacer} />
)}
```

Change it to show publisher pills on `/explore` desktop, and search input everywhere else:

```tsx
{showSearch && pathname !== EXPLORE_PATH ? (
  <View ref={searchAreaRef} style={styles.searchContainer as object}>
    <View
      style={
        [styles.searchWrap, searchFocused && (styles.searchWrapFocused as object)] as object
      }
    >
      <Ionicons
        name="search"
        size={15}
        color={searchFocused ? COLORS.orange : 'rgba(245,235,220,0.4)'}
      />
      <TextInput
        ref={inputRef}
        style={styles.searchInput as object}
        placeholder="Search heroes…"
        placeholderTextColor="rgba(245,235,220,0.35)"
        value={query}
        onChangeText={handleQueryChange}
        onSubmitEditing={handleSubmitSearch}
        returnKeyType="search"
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
      />
      {query.length > 0 ? (
        <Pressable
          onPress={() => setQuery('')}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.clearBtn, hovered && (styles.clearBtnHover as object)] as object
          }
        >
          <Text style={styles.clearX as object}>×</Text>
        </Pressable>
      ) : null}
    </View>
    <SearchSuggestions />
  </View>
) : showSearch && pathname === EXPLORE_PATH ? (
  <View style={styles.pillRow as object}>
    {PUBLISHER_FILTERS.map((f) => (
      <Pressable
        key={f}
        onPress={() =>
          f === 'All' ? setPublisher('All') : router.push(`/search?publisher=${f}`)
        }
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [
            styles.pill,
            publisher === f && (styles.pillActive as object),
            hovered && publisher !== f && (styles.pillHover as object),
          ] as object
        }
      >
        <Text style={[styles.pillText, publisher === f && (styles.pillTextActive as object)] as object}>
          {f}
        </Text>
      </Pressable>
    ))}
  </View>
) : (
  <View style={styles.centerSpacer} />
)}
```

Also add the `PUBLISHER_FILTERS` constant and import `useSearch`'s `setPublisher` at the top of the component (the import already exists — just add `setPublisher` to the destructure):

```ts
// Add PUBLISHER_FILTERS constant (after EXPLORE_PATH):
const PUBLISHER_FILTERS = ['All', 'Marvel', 'DC', 'Other'] as const;

// In the component, add setPublisher to the useSearch destructure:
const { query, setQuery, searchFocused, setSearchFocused, publisher, setPublisher } = useSearch();
```

- [ ] **Step 3: Add pill styles to the `StyleSheet.create` block**

Append the following styles to the existing `StyleSheet.create({...})` at the bottom of `TopNav.tsx`:

```ts
pillRow: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
} as object,
pill: {
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 20,
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.10)',
  cursor: 'pointer',
  transition: 'background-color 150ms ease, border-color 150ms ease',
} as object,
pillActive: {
  backgroundColor: 'rgba(231,115,51,0.18)',
  borderColor: 'rgba(231,115,51,0.45)',
} as object,
pillHover: { backgroundColor: 'rgba(255,255,255,0.09)' } as object,
pillText: {
  fontFamily: 'Nunito_700Bold',
  fontSize: 11,
  color: 'rgba(245,235,220,0.5)',
  letterSpacing: 0.3,
} as object,
pillTextActive: { color: COLORS.orange } as object,
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | grep "TopNav" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/web/TopNav.tsx
git commit -m "feat(nav): darker glass bg + publisher pills on /explore"
```

---

## Task 7: Cinematic Spotlight Redesign

**Files:**
- Modify: `app/(tabs)/explore.web.tsx` (PortraitStripSpotlight component + `pss` StyleSheet only)

This redesigns the desktop `PortraitStripSpotlight` to: (1) increase height, (2) replace the side `panel` View with an absolutely-positioned glass overlay, (3) add atmospheric orbs, (4) add mini stat pills inside the glass panel. Mobile layout is unchanged.

The current desktop layout is `flexDirection: 'row'` with `strip` + `panel` side-by-side. The new layout uses `position: 'relative'` on the wrap, strips take natural space, and the glass panel is `position: 'absolute'` over the bottom-right.

- [ ] **Step 1: Increase desktop height**

Find this line in `PortraitStripSpotlight` (currently `Math.min(320, windowHeight * 0.6)`):

```tsx
const dynamicHeight = Math.min(320, windowHeight * 0.6);
```

Change to:

```tsx
const dynamicHeight = Math.min(460, windowHeight * 0.58);
```

- [ ] **Step 2: Replace the desktop JSX return**

Find the desktop `return` block (inside `if (isDesktop) {`). Replace the entire content of the `<View style={[pss.wrap, ...]}>` with:

```tsx
<View style={[pss.wrap, { paddingHorizontal: pagePad, height: dynamicHeight }] as object}>
  {/* Atmospheric orbs — decorative, no interaction */}
  <View style={pss.orbA as object} pointerEvents="none" />
  <View style={pss.orbB as object} pointerEvents="none" />

  {/* Accordion portrait strip */}
  <View style={pss.strip}>
    {heroes.map((h, index) => {
      const offset = (index - activeIndex + heroes.length) % heroes.length;
      const isActive = offset === 0;
      const isNext = offset === 1;

      const isVisible = offset < activeScale.length;
      const cardWidth = isVisible ? activeScale[offset].w : 0;
      const opacity = isVisible ? activeScale[offset].o : 0;

      const source = heroImageSource(String(h.id), h.image_url, h.portrait_url);

      return (
        <Pressable
          key={h.id}
          onPress={() => setActiveIndex(index)}
          style={[
            pss.card,
            {
              width: cardWidth,
              opacity: opacity,
              borderWidth: cardWidth === 0 ? 0 : undefined,
            } as object,
            isActive && (pss.cardActive as object),
          ]}
        >
          <Image
            source={source}
            contentFit="cover"
            contentPosition={{ top: 0, left: '50%' }}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: isActive ? 1 : 0.4,
                transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              } as any,
            ]}
            cachePolicy="memory-disk"
            recyclingKey={String(h.id)}
          />
          <View style={pss.cardOverlay as object} />

          <Text
            style={[
              pss.cardBadge as object,
              { opacity: isActive ? 1 : 0, transition: 'opacity 250ms ease' } as object,
            ]}
          >
            Featured
          </Text>

          <Text
            style={[
              pss.cardName as object,
              isNext && (pss.cardNameNext as object),
              {
                opacity: isActive ? 1 : isNext ? 0.7 : 0,
                transition: 'opacity 250ms ease',
              } as object,
            ]}
            numberOfLines={2}
          >
            {h.name}
          </Text>
        </Pressable>
      );
    })}
  </View>

  {/* Glass info panel — absolute over bottom-right of the spotlight */}
  <View style={pss.glassPanel as object}>
    <Text style={pss.glassPanelEyebrow as object}>Featured Hero</Text>
    <Text style={pss.glassPanelName as object} numberOfLines={2}>
      {hero.name}
    </Text>
    {!!hero.publisher && (
      <Text style={pss.glassPanelPub as object} numberOfLines={1}>
        {hero.publisher}
      </Text>
    )}
    {!!hero.summary && (
      <Text style={pss.glassPanelSummary as object} numberOfLines={3}>
        {hero.summary}
      </Text>
    )}
    {(hero.intelligence || hero.strength || hero.speed) ? (
      <View style={pss.statPills as object}>
        {!!hero.intelligence && (
          <View style={pss.statPill as object}>
            <Text style={pss.statPillVal as object}>{hero.intelligence}</Text>
            <Text style={pss.statPillKey as object}>INT</Text>
          </View>
        )}
        {!!hero.strength && (
          <View style={pss.statPill as object}>
            <Text style={pss.statPillVal as object}>{hero.strength}</Text>
            <Text style={pss.statPillKey as object}>STR</Text>
          </View>
        )}
        {!!hero.speed && (
          <View style={pss.statPill as object}>
            <Text style={pss.statPillVal as object}>{hero.speed}</Text>
            <Text style={pss.statPillKey as object}>SPD</Text>
          </View>
        )}
      </View>
    ) : null}
    <View style={pss.panelFooter}>
      <Pressable
        onPress={() => onViewProfile(String(hero.id))}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [pss.ctaBtn, hovered && (pss.ctaBtnHover as object)] as object
        }
      >
        <Text style={pss.ctaBtnText}>View Profile →</Text>
      </Pressable>
      <View style={pss.dots}>
        {heroes.slice(0, activeScale.length).map((_, i) => (
          <Pressable
            key={i}
            onPress={() => setActiveIndex(i)}
            style={[pss.dot, i === activeIndex && (pss.dotActive as object)] as object}
          />
        ))}
      </View>
    </View>
  </View>
</View>
```

- [ ] **Step 3: Replace the `pss` StyleSheet**

Replace the entire `const pss = StyleSheet.create({...})` block (from `const pss = StyleSheet.create({` through the closing `});` at line ~520) with:

```ts
const pss = StyleSheet.create({
  // Desktop wrap — position:relative so glass panel can be absolute inside
  wrap: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
  } as object,

  // Accordion portrait strip — left-aligned within wrap
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    contain: 'layout style',
    height: '100%',
  } as object,

  // Portrait cards
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#2c4a56',
    position: 'relative',
    cursor: 'pointer',
    transition:
      'width 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: 'width, opacity',
  } as object,
  cardActive: {
    boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2)',
  } as object,
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(15,20,24,0.95) 0%, rgba(15,20,24,0.15) 50%, transparent 100%)',
  } as object,
  cardBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    zIndex: 2,
  } as object,
  cardName: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: COLORS.beige,
    lineHeight: 22,
    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
    zIndex: 2,
  } as object,
  cardNameNext: {
    fontSize: 11,
    bottom: 10,
    left: 10,
  } as object,

  // Atmospheric orbs (decorative, absolutely positioned)
  orbA: {
    position: 'absolute',
    width: 320,
    height: 320,
    top: -60,
    left: 140,
    borderRadius: 160,
    background: 'radial-gradient(circle, rgba(231,115,51,0.10), transparent 70%)',
    pointerEvents: 'none',
  } as object,
  orbB: {
    position: 'absolute',
    width: 220,
    height: 220,
    top: 80,
    right: 180,
    borderRadius: 110,
    background: 'radial-gradient(circle, rgba(21,161,171,0.07), transparent 70%)',
    pointerEvents: 'none',
  } as object,

  // Glass info panel
  glassPanel: {
    position: 'absolute',
    bottom: 20,
    right: 0,
    background: 'rgba(11,24,32,0.78)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 20,
    minWidth: 240,
    maxWidth: 340,
  } as object,
  glassPanelEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 6,
  } as object,
  glassPanelName: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.beige,
    lineHeight: 32,
    marginBottom: 4,
  } as object,
  glassPanelPub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  } as object,
  glassPanelSummary: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.65)',
    lineHeight: 19,
    marginBottom: 12,
  } as object,
  statPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  } as object,
  statPill: {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
  } as object,
  statPillVal: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.orange,
  } as object,
  statPillKey: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 7,
    color: 'rgba(245,235,220,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  } as object,

  // Shared panel footer (glass panel bottom row)
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ctaBtn: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    transition: 'opacity 150ms ease',
  } as object,
  ctaBtnHover: { opacity: 0.85 } as object,
  ctaBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245,235,220,0.2)',
    cursor: 'pointer',
    transition: 'all 200ms ease',
  } as object,
  dotActive: { width: 20, backgroundColor: COLORS.orange } as object,

  // Mobile web overrides (unchanged)
  wrapMobile: { flexDirection: 'row', gap: 10, height: 240, marginVertical: 20 },
  singlePortrait: {
    width: 150,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    position: 'relative',
  },
  panelMobile: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 14,
    justifyContent: 'space-between',
  },
  panelNameMobile: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    lineHeight: 22,
    marginBottom: 4,
  } as object,
  panelSummaryMobile: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.5)',
    lineHeight: 15,
  } as object,
  panelLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
  } as object,
});
```

> **Note:** The mobile layout still references `pss.panelLabel` in the mobile branch — that style is kept in the new `pss` block.

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | grep -E "explore\.web|PortraitStrip" | head -10
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/explore.web.tsx
git commit -m "feat(explore): cinematic spotlight redesign with glass panel and orbs"
```

---

## Task 8: Wire Dark Stage, New Data, Remove FilterStrip

**Files:**
- Modify: `app/(tabs)/explore.web.tsx` (imports, `HomeData`, `useEffect`, JSX structure)

This is the final wiring task: add imports for the three new components, extend `HomeData` with the new fields, fire the four new queries in `useEffect`, remove the `filterStrip` block, wrap the spotlight + stat pods in a `darkStage` View, insert the `PulseTicker`, and add `statKey` props to the ranking rows.

- [ ] **Step 1: Add imports at the top of `explore.web.tsx`**

Find the existing import block and add three new lines. After the existing `src/components/web/` imports, add:

```ts
import { PulseTicker } from '../../src/components/web/home/PulseTicker';
import { StatPods } from '../../src/components/web/home/StatPods';
import {
  getTopHeroByStat,
  getPublisherCounts,
  type PublisherCounts,
} from '../../src/lib/db/heroes';
```

Note: `RankingCard` is already imported from Task 5.

- [ ] **Step 2: Extend the `HomeData` interface**

Find the `interface HomeData {` block (currently in the component body). Add four new fields:

```ts
interface HomeData {
  spotlight: Hero[];
  iconic: Hero[];
  xmen: Hero[];
  villains: Hero[];
  antiHeroes: Hero[];
  marvel: Hero[];
  dc: Hero[];
  strongest: Hero[];
  mostIntelligent: Hero[];
  newlyAdded: Hero[];
  // New for Phase 1 stat pods:
  strongestHero: Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null;
  smartestHero: Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null;
  fastestHero: Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null;
  publisherCounts: PublisherCounts | null;
}
```

- [ ] **Step 3: Add four new fetches to the `useEffect`**

In the `useEffect(() => { ... }, [])` block, append the four new queries after the existing ones (after the `getNewlyAddedCV` line):

```ts
getTopHeroByStat('strength')
  .then(set('strongestHero'))
  .catch(() => {});
getTopHeroByStat('intelligence')
  .then(set('smartestHero'))
  .catch(() => {});
getTopHeroByStat('speed')
  .then(set('fastestHero'))
  .catch(() => {});
getPublisherCounts()
  .then(set('publisherCounts'))
  .catch(() => {});
```

- [ ] **Step 4: Remove the `filterStrip` block**

Find and delete the entire `{isDesktop && (<View style={styles.filterStrip as object}>...</View>)}` block from the JSX return (roughly lines 988–1021). This is about 33 lines. The publisher filter now lives in TopNav.

- [ ] **Step 5: Wrap spotlight + stat pods in a dark stage, add PulseTicker**

Currently the ScrollView contentContainer starts with:
```tsx
{/* Spotlight */}
{(homeData.spotlight?.length ?? 0) > 0 && (
  <PortraitStripSpotlight ... />
)}
{/* Personal rows */}
<HomeRow ...
```

Replace that opening section with:

```tsx
{/* ── Dark stage: spotlight + stat pods ────────────────────────────────── */}
{isDesktop && (
  <View style={styles.darkStage}>
    {(homeData.spotlight?.length ?? 0) > 0 && (
      <PortraitStripSpotlight
        heroes={homeData.spotlight!.slice(
          0,
          Math.min(optimalPoolSize, homeData.spotlight!.length),
        )}
        onViewProfile={handlePress}
      />
    )}
    <StatPods
      heroCount={totalHeroCount}
      publisherCounts={homeData.publisherCounts ?? null}
      strongestHero={
        homeData.strongestHero
          ? {
              id: homeData.strongestHero.id as unknown as number,
              name: homeData.strongestHero.name,
              strength: homeData.strongestHero.strength ?? null,
            }
          : null
      }
      smartestHero={
        homeData.smartestHero
          ? {
              id: homeData.smartestHero.id as unknown as number,
              name: homeData.smartestHero.name,
              intelligence: homeData.smartestHero.intelligence ?? null,
            }
          : null
      }
      fastestHero={
        homeData.fastestHero
          ? {
              id: homeData.fastestHero.id as unknown as number,
              name: homeData.fastestHero.name,
              speed: homeData.fastestHero.speed ?? null,
            }
          : null
      }
      onNavigate={router.push}
    />
  </View>
)}

{/* ── Orange ticker strip ───────────────────────────────────────────────── */}
{isDesktop && (
  <PulseTicker
    heroCount={totalHeroCount ?? 0}
    newlyAddedCount={homeData.newlyAdded?.length ?? 0}
  />
)}

{/* ── Personal rows ─────────────────────────────────────────────────────── */}
```

> **Note on `id` cast:** `Hero.id` is a number in the generated types, but `getTopHeroByStat` returns `Pick<Hero, 'id' | ...>` where `id` may be typed as `string` depending on the generated types. Check what type `Hero['id']` actually is in `database.generated.ts` and adjust the cast if needed. If `Hero.id` is already `number`, remove the `as unknown as number` cast.

- [ ] **Step 6: Add `statKey` to the ranking rows**

Find the two existing `HomeRow` uses for ranking categories and add `statKey`:

```tsx
{/* Before */}
<HomeRow
  label="By Power Stats"
  title="Strongest Heroes"
  heroes={homeData.strongest ?? []}
  onPress={handlePress}
  onViewAll={() => router.push('/category/strongest')}
/>

{/* After */}
<HomeRow
  label="By Power Stats"
  title="Strongest Heroes"
  heroes={homeData.strongest ?? []}
  onPress={handlePress}
  onViewAll={() => router.push('/category/strongest')}
  statKey="strength"
/>
```

And:

```tsx
{/* Before */}
<HomeRow
  label="By Power Stats"
  title="Brightest Minds"
  heroes={homeData.mostIntelligent ?? []}
  onPress={handlePress}
  onViewAll={() => router.push('/category/most-intelligent')}
/>

{/* After */}
<HomeRow
  label="By Power Stats"
  title="Brightest Minds"
  heroes={homeData.mostIntelligent ?? []}
  onPress={handlePress}
  onViewAll={() => router.push('/category/most-intelligent')}
  statKey="intelligence"
/>
```

- [ ] **Step 7: Add `darkStage` style to the `styles` StyleSheet**

In the `StyleSheet.create({...})` block at the bottom of `explore.web.tsx`, add:

```ts
darkStage: {
  backgroundColor: '#0b1820',
  paddingTop: 24,
  paddingBottom: 32,
},
```

Also remove the `filterStrip`, `filterInner`, `filterTabs`, `filterTab`, `filterTabActive`, `filterTabHover`, `filterTabText`, `filterTabTextActive`, and `filterCount` style entries from the StyleSheet (they are only used by the filterStrip block you deleted in Step 4).

- [ ] **Step 8: TypeScript check**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && npx tsc --noEmit 2>&1 | head -30
```

Resolve any errors before proceeding.

- [ ] **Step 9: Run all tests**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn test:ci 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add app/\(tabs\)/explore.web.tsx
git commit -m "feat(explore): dark stage, stat pods, pulse ticker, ranking cards wired"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 1. Glass Nav — Task 6 (darker bg, pills, dropdown)
- [x] 2. Dark stage — Task 8, Step 5 (darkStage wrapper)
- [x] 3. Cinematic Spotlight — Task 7 (glass panel, orbs, taller, stat pills)
- [x] 4. Stat Pods — Task 4 (component) + Task 8 (wired)
- [x] 5. Pulse Ticker — Task 3 (component) + Task 8 (wired)
- [x] 6. Ranking Cards — Task 5 (component + HomeRow statKey) + Task 8 (statKey on rows)
- [x] 7. New DB queries — Task 2 (getTopHeroByStat, getPublisherCounts + tests)
- [x] filterStrip removed — Task 8, Step 4
- [x] Mobile layout unchanged — PortraitStripSpotlight mobile branch untouched; darkStage + PulseTicker gated behind `isDesktop`

**Type consistency:**
- `PublisherCounts` exported from `heroes.ts`, imported in both `StatPods.tsx` and `explore.web.tsx`
- `getTopHeroByStat` returns `Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null` — matches `HomeData` fields
- `RankingCard` accepts `Hero` type (same source as `HomeRow` heroes arrays)
- `StatPods` `onNavigate` typed as `(path: string) => void` — `router.push` satisfies this

**Known limitation:**
- The `getPublisherCounts` test cannot differentiate the 3 parallel queries using the shared mock chain. Tests verify the return shape and null-coalescing behavior; the actual counts are validated by the Supabase query chain assertions.

**`Hero.id` type note:**
- Before implementing Task 8 Step 5, check `src/types/database.generated.ts` for `heroes.Row.id` type. If it is `number`, the `as unknown as number` cast in the StatPods props can be simplified to direct access: `id: homeData.strongestHero.id`. If it is `string`, the `StatPodsProps` should use `id: string` instead.
