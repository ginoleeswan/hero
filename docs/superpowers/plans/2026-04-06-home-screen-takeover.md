# Home Screen Takeover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Explore screen with a full-bleed immersive home — Netflix-style spotlight banner + 10 curated/personal carousels + slide-up search modal.

**Architecture:** The spotlight banner extends behind the status bar using `useSafeAreaInsets` (same pattern as the character detail screen). A single `ScrollView` renders the spotlight as its first child, then all row sections below on a beige background. Search logic is extracted into a standalone `SearchSheet` modal component. View history is stored in a new `user_view_history` Supabase table and recorded on every character screen open.

**Tech Stack:** Expo SDK 55, React Native `Animated`, `expo-image`, `expo-linear-gradient`, `react-native-safe-area-context`, Supabase, `bun`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/YYYYMMDDHHMMSS_add_user_view_history.sql` | Create | DB schema for view history |
| `src/types/database.generated.ts` | Regenerate | Auto-generated — do not edit |
| `src/lib/db/viewHistory.ts` | Create | `recordView` + `getRecentlyViewed` |
| `src/lib/db/heroes.ts` | Modify | Add `getAntiHeroes`, `getHeroesByPublisher`, `getHeroesByStatRanking` |
| `src/hooks/useViewHistory.ts` | Create | `useRecordView` hook (fire-and-forget for character screen) |
| `app/character/[id].tsx` | Modify | Call `useRecordView` on mount |
| `src/components/home/ThumbCard.tsx` | Create | Landscape 90×58 card for personal rows |
| `src/components/home/SpotlightBanner.tsx` | Create | Full-bleed hero banner with search icon + dots |
| `src/components/home/HomeHeroRow.tsx` | Create | Section row: label + title + horizontal FlatList |
| `src/components/SearchSheet.tsx` | Create | Slide-up modal containing all search logic |
| `src/components/skeletons/HomeSkeleton.tsx` | Modify | Spotlight + rows skeleton layout |
| `app/(tabs)/index.tsx` | Rewrite | Ties all pieces together — data fetching + layout |
| `__tests__/lib/db/viewHistory.test.ts` | Create | Unit tests for viewHistory DB functions |
| `__tests__/lib/db/heroes.test.ts` | Modify | Add tests for the 3 new hero queries |

---

## Task 1: DB Migration — user_view_history

**Files:**
- Create: `supabase/migrations/20260406120000_add_user_view_history.sql`

- [ ] **Step 1.1: Write the migration SQL**

```sql
-- supabase/migrations/20260406120000_add_user_view_history.sql
create table user_view_history (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  hero_id    text        not null,
  viewed_at  timestamptz not null default now(),
  unique(user_id, hero_id)
);

create index user_view_history_user_recent
  on user_view_history(user_id, viewed_at desc);

alter table user_view_history enable row level security;

create policy "Users can manage their own view history"
  on user_view_history
  for all
  using (auth.uid() = user_id);
```

- [ ] **Step 1.2: Apply the migration via Supabase MCP**

Use the MCP tool: `mcp__supabase__apply_migration` with the SQL above.

- [ ] **Step 1.3: Regenerate TypeScript types**

Use the MCP tool: `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts`. Never edit this file by hand.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260406120000_add_user_view_history.sql src/types/database.generated.ts
git commit -m "feat(db): add user_view_history table with RLS"
```

---

## Task 2: viewHistory DB Functions + Tests

**Files:**
- Create: `src/lib/db/viewHistory.ts`
- Create: `__tests__/lib/db/viewHistory.test.ts`

- [ ] **Step 2.1: Write the failing tests first**

```typescript
// __tests__/lib/db/viewHistory.test.ts
import { recordView, getRecentlyViewed } from '../../../src/lib/db/viewHistory';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
// Each table gets its own chain so two from() calls in one function return
// different resolved values.

let resolvers: Record<string, { data: unknown; error: unknown }> = {};

jest.mock('../../../src/lib/supabase', () => {
  const makeChain = (tableName: string) => {
    const methods = ['select', 'eq', 'order', 'limit', 'in'];
    const c: Record<string, unknown> = {};
    methods.forEach((m) => {
      c[m] = jest.fn().mockReturnValue(c);
    });
    c.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolvers[tableName] ?? { data: null, error: null }).then(resolve);
    c.upsert = jest.fn().mockImplementation(() =>
      Promise.resolve(resolvers[tableName] ?? { data: null, error: null }),
    );
    return c;
  };

  const chains: Record<string, ReturnType<typeof makeChain>> = {};
  const mockFrom = jest.fn().mockImplementation((tableName: string) => {
    if (!chains[tableName]) chains[tableName] = makeChain(tableName);
    return chains[tableName];
  });

  return { supabase: { from: mockFrom }, __chains: chains, __mockFrom: mockFrom };
});

const { __chains: chains, __mockFrom: mockFrom } = jest.requireMock(
  '../../../src/lib/supabase',
) as {
  __chains: Record<string, Record<string, jest.Mock>>;
  __mockFrom: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  resolvers = {};
  // Re-wire chains after clearAllMocks
  Object.values(chains).forEach((c) => {
    ['select', 'eq', 'order', 'limit', 'in'].forEach((m) => {
      c[m].mockReturnValue(c);
    });
  });
  mockFrom.mockImplementation((tableName: string) => {
    if (!chains[tableName]) {
      // makeChain not accessible here — recreate inline
      const methods = ['select', 'eq', 'order', 'limit', 'in'];
      const c: Record<string, unknown> = {};
      methods.forEach((m) => {
        c[m] = jest.fn().mockReturnValue(c);
      });
      c.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(resolvers[tableName] ?? { data: null, error: null }).then(resolve);
      c.upsert = jest.fn().mockImplementation(() =>
        Promise.resolve(resolvers[tableName] ?? { data: null, error: null }),
      );
      chains[tableName] = c as Record<string, jest.Mock>;
    }
    return chains[tableName];
  });
});

// ─── recordView ───────────────────────────────────────────────────────────────

describe('recordView', () => {
  it('upserts into user_view_history', async () => {
    resolvers['user_view_history'] = { data: null, error: null };
    await recordView('user-1', 'hero-620');
    expect(mockFrom).toHaveBeenCalledWith('user_view_history');
    expect(chains['user_view_history'].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', hero_id: 'hero-620' }),
      { onConflict: 'user_id,hero_id' },
    );
  });

  it('does not throw on upsert error (fire-and-forget contract)', async () => {
    resolvers['user_view_history'] = { data: null, error: { message: 'conflict' } };
    await expect(recordView('user-1', 'hero-620')).resolves.toBeUndefined();
  });
});

// ─── getRecentlyViewed ────────────────────────────────────────────────────────

describe('getRecentlyViewed', () => {
  it('returns empty array when no history rows', async () => {
    resolvers['user_view_history'] = { data: [], error: null };
    const result = await getRecentlyViewed('user-1');
    expect(result).toEqual([]);
    // Should not query heroes table when no history
    expect(mockFrom).not.toHaveBeenCalledWith('heroes');
  });

  it('returns heroes in view order (most recent first)', async () => {
    resolvers['user_view_history'] = {
      data: [{ hero_id: '620' }, { hero_id: '70' }],
      error: null,
    };
    resolvers['heroes'] = {
      data: [
        { id: '70', name: 'Batman', image_url: null, portrait_url: null },
        { id: '620', name: 'Spider-Man', image_url: null, portrait_url: null },
      ],
      error: null,
    };
    const result = await getRecentlyViewed('user-1');
    expect(result[0].id).toBe('620'); // most recent first
    expect(result[1].id).toBe('70');
  });

  it('throws when history query errors', async () => {
    resolvers['user_view_history'] = { data: null, error: { message: 'DB error' } };
    await expect(getRecentlyViewed('user-1')).rejects.toMatchObject({ message: 'DB error' });
  });
});
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
bun run test:ci -- __tests__/lib/db/viewHistory.test.ts
```

Expected: `FAIL` — `Cannot find module '../../../src/lib/db/viewHistory'`

- [ ] **Step 2.3: Write the implementation**

```typescript
// src/lib/db/viewHistory.ts
import { supabase } from '../supabase';
import type { FavouriteHero } from './favourites';

export async function recordView(userId: string, heroId: string): Promise<void> {
  // Upsert — keeps one row per hero, updated_at reflects most recent visit
  await supabase
    .from('user_view_history')
    .upsert(
      { user_id: userId, hero_id: heroId, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,hero_id' },
    );
  // Intentionally swallow errors — this is fire-and-forget
}

export async function getRecentlyViewed(
  userId: string,
  limit = 15,
): Promise<FavouriteHero[]> {
  const { data: historyData, error: historyError } = await supabase
    .from('user_view_history')
    .select('hero_id')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);

  if (historyError) throw historyError;

  const heroIds = (historyData ?? []).map((r) => r.hero_id as string);
  if (heroIds.length === 0) return [];

  const { data: heroData, error: heroError } = await supabase
    .from('heroes')
    .select('id, name, image_url, portrait_url')
    .in('id', heroIds);

  if (heroError) throw heroError;

  // Preserve viewed_at order (most recent first)
  const heroMap = new Map((heroData ?? []).map((h) => [h.id as string, h as FavouriteHero]));
  return heroIds.map((id) => heroMap.get(id)).filter((h): h is FavouriteHero => h !== undefined);
}
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
bun run test:ci -- __tests__/lib/db/viewHistory.test.ts
```

Expected: `PASS` — all 5 tests green

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/db/viewHistory.ts __tests__/lib/db/viewHistory.test.ts
git commit -m "feat(db): add viewHistory functions — recordView and getRecentlyViewed"
```

---

## Task 3: New Hero Queries + Tests

**Files:**
- Modify: `src/lib/db/heroes.ts`
- Modify: `__tests__/lib/db/heroes.test.ts`

- [ ] **Step 3.1: Add failing tests to the existing heroes test file**

Append to `__tests__/lib/db/heroes.test.ts`, after the existing `describe` blocks:

```typescript
// ─── getAntiHeroes ────────────────────────────────────────────────────────────

describe('getAntiHeroes', () => {
  it('filters by neutral alignment', async () => {
    mockResolveWith = { data: [], error: null };
    await getAntiHeroes();
    expect(chain.ilike).toHaveBeenCalledWith('alignment', '%neutral%');
  });

  it('applies limit', async () => {
    mockResolveWith = { data: [], error: null };
    await getAntiHeroes(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('throws on error', async () => {
    mockResolveWith = { data: null, error: { message: 'fail' } };
    await expect(getAntiHeroes()).rejects.toThrow('fail');
  });
});

// ─── getHeroesByPublisher ──────────────────────────────────────────────────────

describe('getHeroesByPublisher', () => {
  it('filters by marvel publisher', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByPublisher('marvel');
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%marvel%');
  });

  it('filters by dc publisher', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByPublisher('dc');
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%dc%');
  });

  it('throws on error', async () => {
    mockResolveWith = { data: null, error: { message: 'fail' } };
    await expect(getHeroesByPublisher('marvel')).rejects.toThrow('fail');
  });
});

// ─── getHeroesByStatRanking ───────────────────────────────────────────────────

describe('getHeroesByStatRanking', () => {
  it('orders by strength descending', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByStatRanking('strength');
    expect(chain.order).toHaveBeenCalledWith('strength', { ascending: false });
  });

  it('orders by intelligence descending', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByStatRanking('intelligence');
    expect(chain.order).toHaveBeenCalledWith('intelligence', { ascending: false });
  });

  it('excludes null stat values', async () => {
    mockResolveWith = { data: [], error: null };
    await getHeroesByStatRanking('strength');
    expect(chain.not).toHaveBeenCalledWith('strength', 'is', null);
  });

  it('throws on error', async () => {
    mockResolveWith = { data: null, error: { message: 'fail' } };
    await expect(getHeroesByStatRanking('strength')).rejects.toThrow('fail');
  });
});
```

Also add the three new function names to the import at the top of the test file:

```typescript
import {
  getHeroById,
  searchHeroes,
  heroRowToCharacterData,
  getAntiHeroes,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  type Hero,
} from '../../../src/lib/db/heroes';
```

- [ ] **Step 3.2: Run tests — verify new ones fail**

```bash
bun run test:ci -- __tests__/lib/db/heroes.test.ts
```

Expected: `FAIL` — `getAntiHeroes is not a function`

- [ ] **Step 3.3: Add the three functions to heroes.ts**

Append to the bottom of `src/lib/db/heroes.ts`:

```typescript
export async function getAntiHeroes(limit = 20): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .ilike('alignment', '%neutral%')
    .order('name')
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getHeroesByPublisher(
  publisher: 'marvel' | 'dc',
  limit = 20,
): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .ilike('publisher', `%${publisher}%`)
    .order('name')
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getHeroesByStatRanking(
  stat: 'strength' | 'intelligence',
  limit = 20,
): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .not(stat, 'is', null)
    .order(stat, { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

- [ ] **Step 3.4: Run all tests — verify everything passes**

```bash
bun run test:ci -- __tests__/lib/db/heroes.test.ts
```

Expected: `PASS` — all tests (existing + new 10) green

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.test.ts
git commit -m "feat(db): add getAntiHeroes, getHeroesByPublisher, getHeroesByStatRanking"
```

---

## Task 4: useRecordView Hook + Character Screen

**Files:**
- Create: `src/hooks/useViewHistory.ts`
- Modify: `app/character/[id].tsx`

- [ ] **Step 4.1: Create the hook**

```typescript
// src/hooks/useViewHistory.ts
import { useEffect } from 'react';
import { recordView } from '../lib/db/viewHistory';

/**
 * Fire-and-forget: records a hero view in user_view_history when the
 * character screen mounts. Safe to call unconditionally — skips if no userId.
 */
export function useRecordView(userId: string | undefined, heroId: string): void {
  useEffect(() => {
    if (!userId || !heroId) return;
    recordView(userId, heroId).catch(() => {});
  }, [userId, heroId]);
}
```

- [ ] **Step 4.2: Add the hook call to the character screen**

In `app/character/[id].tsx`, add the import after the existing `useAuth` import line:

```typescript
import { useRecordView } from '../../src/hooks/useViewHistory';
```

Then, inside `CharacterScreen`, add this line directly after the `const { user } = useAuth();` line:

```typescript
useRecordView(user?.id, id);
```

- [ ] **Step 4.3: Run full test suite to confirm nothing broke**

```bash
bun run test:ci
```

Expected: `PASS` — all existing tests still green

- [ ] **Step 4.4: Commit**

```bash
git add src/hooks/useViewHistory.ts app/character/[id].tsx
git commit -m "feat: record hero views via useRecordView hook on character screen"
```

---

## Task 5: ThumbCard Component

**Files:**
- Create: `src/components/home/ThumbCard.tsx`

- [ ] **Step 5.1: Create the component**

```typescript
// src/components/home/ThumbCard.tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';

export interface ThumbHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
}

interface ThumbCardProps {
  item: ThumbHero;
  onPress: () => void;
  disabled?: boolean;
}

export function ThumbCard({ item, onPress, disabled = false }: ThumbCardProps) {
  const source = heroImageSource(item.id, item.image_url, item.portrait_url);
  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
        transition={null}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.85)']}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 90,
    height: 58,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  name: {
    position: 'absolute',
    bottom: 5,
    left: 6,
    right: 6,
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.beige,
    lineHeight: 11,
  },
});
```

- [ ] **Step 5.2: Commit**

```bash
git add src/components/home/ThumbCard.tsx
git commit -m "feat(ui): add ThumbCard — landscape thumbnail for personal rows"
```

---

## Task 6: SpotlightBanner Component

**Files:**
- Create: `src/components/home/SpotlightBanner.tsx`

- [ ] **Step 6.1: Create the component**

```typescript
// src/components/home/SpotlightBanner.tsx
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function spotlightHeight(insetTop: number): number {
  return insetTop + Math.round(SCREEN_HEIGHT * 0.42);
}

interface SpotlightBannerProps {
  hero: Hero;
  index: number;
  total: number;
  insetTop: number;
  onSearchPress: () => void;
  onHeroPress: () => void;
}

export function SpotlightBanner({
  hero,
  index,
  total,
  insetTop,
  onSearchPress,
  onHeroPress,
}: SpotlightBannerProps) {
  const height = spotlightHeight(insetTop);
  const source = heroImageSource(hero.id, hero.image_url, hero.portrait_url);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onHeroPress}
      style={[styles.container, { height }]}
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={hero.id}
        transition={200}
      />
      {/* Gradient fade to beige at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(245,235,220,0.6)', COLORS.beige]}
        locations={[0.45, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Search icon */}
      <TouchableOpacity
        style={[styles.searchBtn, { top: insetTop + 10 }]}
        onPress={onSearchPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="search" size={20} color={COLORS.beige} />
      </TouchableOpacity>
      {/* Hero metadata */}
      <View style={styles.meta}>
        <Text style={styles.metaLabel}>Featured Hero</Text>
        <Text style={styles.metaName} numberOfLines={2}>
          {hero.name}
        </Text>
        {!!hero.publisher && (
          <Text style={styles.metaPublisher} numberOfLines={1}>
            {hero.publisher}
          </Text>
        )}
      </View>
      {/* Dot indicator */}
      {total > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: COLORS.navy },
  searchBtn: {
    position: 'absolute',
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(41,60,67,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { position: 'absolute', bottom: 56, left: 16, right: 68 },
  metaLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaName: {
    fontFamily: 'Flame-Bold',
    fontSize: 30,
    color: COLORS.navy,
    lineHeight: 32,
  },
  metaPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  dots: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(41,60,67,0.3)',
  },
  dotActive: { width: 14, backgroundColor: COLORS.orange },
});
```

- [ ] **Step 6.2: Commit**

```bash
git add src/components/home/SpotlightBanner.tsx
git commit -m "feat(ui): add SpotlightBanner — full-bleed hero with search icon and dots"
```

---

## Task 7: HomeHeroRow Component

**Files:**
- Create: `src/components/home/HomeHeroRow.tsx`

- [ ] **Step 7.1: Create the component**

```typescript
// src/components/home/HomeHeroRow.tsx
import { View, Text, FlatList, StyleSheet, Dimensions } from 'react-native';
import { HeroCard } from '../HeroCard';
import { ThumbCard, type ThumbHero } from './ThumbCard';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTRAIT_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);

export interface RowHero extends ThumbHero {}

interface HomeHeroRowProps {
  label?: string;
  title: string;
  heroes: RowHero[];
  variant?: 'portrait' | 'thumb';
  onPress: (item: RowHero) => void;
  disabled?: boolean;
}

export function HomeHeroRow({
  label,
  title,
  heroes,
  variant = 'portrait',
  onPress,
  disabled = false,
}: HomeHeroRowProps) {
  const isPortrait = variant === 'portrait';

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {!!label && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <FlatList
        horizontal
        data={heroes}
        keyExtractor={(h) => h.id}
        showsHorizontalScrollIndicator={false}
        decelerationRate={isPortrait ? 'fast' : 'normal'}
        snapToInterval={isPortrait ? PORTRAIT_CARD_WIDTH + 12 : undefined}
        contentContainerStyle={[
          styles.listContent,
          { gap: isPortrait ? 12 : 8 },
        ]}
        renderItem={({ item }) =>
          isPortrait ? (
            <View style={{ width: PORTRAIT_CARD_WIDTH }}>
              <HeroCard
                id={item.id}
                name={item.name}
                imageUrl={item.image_url}
                portraitUrl={item.portrait_url}
                onPress={() => onPress(item)}
              />
            </View>
          ) : (
            <ThumbCard item={item} onPress={() => onPress(item)} disabled={disabled} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 4 },
  header: { paddingHorizontal: 15, marginBottom: 10, gap: 2 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  listContent: { paddingHorizontal: 15 },
});
```

- [ ] **Step 7.2: Commit**

```bash
git add src/components/home/HomeHeroRow.tsx
git commit -m "feat(ui): add HomeHeroRow — reusable section with portrait or thumb cards"
```

---

## Task 8: SearchSheet Component

**Files:**
- Create: `src/components/SearchSheet.tsx`

- [ ] **Step 8.1: Create the component**

The search logic (state, debounce, filter, rank) migrates wholesale from `index.tsx` into this self-contained modal.

```typescript
// src/components/SearchSheet.tsx
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { heroGridImageSource } from '../constants/heroImages';
import { searchHeroes, rankResults } from '../lib/db/heroes';
import type { HeroSearchResult, PublisherFilter } from '../lib/db/heroes';

const PUBLISHER_PILLS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
const GRID_COLUMNS = 2;
const H_PAD = 12;
const GAP = 8;
const DISPLAY_LIMIT = 100;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MARVEL_LOGO = require('../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../assets/images/DC-Logo.png') as number;
const DARK_HORSE_LOGO = require('../../assets/images/Dark_Horse_Comics_logo.png') as number;
const STAR_WARS_LOGO = require('../../assets/images/star-wars-logo.png') as number;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PortraitCard({
  item,
  cardWidth,
  onPress,
  disabled,
}: {
  item: HeroSearchResult;
  cardWidth: number;
  onPress: () => void;
  disabled: boolean;
}) {
  const source = heroGridImageSource(item.id, item.image_url, item.portrait_url);
  const pub = (item.publisher ?? '').toLowerCase();
  const isMarvel = pub.includes('marvel');
  const isDC = pub.includes('dc');
  const isDarkHorse = pub.includes('dark horse');
  const isStarWars = pub.includes('george lucas') || pub.includes('star wars');
  const hasLogo = isMarvel || isDC || isDarkHorse || isStarWars;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
      style={[pcard.wrap, { width: cardWidth, height: Math.round(cardWidth * 1.48) }]}
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
        transition={null}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.18)', 'rgba(29,45,51,0.97)']}
        locations={[0, 0.45, 1]}
        style={pcard.gradient}
      />
      {hasLogo ? (
        <View style={pcard.logoWrap}>
          <Image
            source={
              isMarvel ? MARVEL_LOGO
              : isDC ? DC_LOGO
              : isDarkHorse ? DARK_HORSE_LOGO
              : STAR_WARS_LOGO
            }
            style={
              isMarvel ? pcard.logoMarvel
              : isDC ? pcard.logoDC
              : isDarkHorse ? pcard.logoDarkHorse
              : pcard.logoStarWars
            }
            contentFit="contain"
          />
        </View>
      ) : item.publisher ? (
        <View style={pcard.pubTextWrap}>
          <Text style={pcard.pubText} numberOfLines={1}>{item.publisher}</Text>
        </View>
      ) : null}
      <View style={pcard.bottom}>
        <Text style={pcard.name} numberOfLines={2}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const pcard = StyleSheet.create({
  wrap: { borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.navy },
  gradient: { ...StyleSheet.absoluteFillObject },
  logoWrap: { position: 'absolute', top: 10, left: 10 },
  logoMarvel: { width: 38, height: 15, borderRadius: 3 },
  logoDC: { width: 22, height: 22, borderRadius: 3 },
  logoDarkHorse: { width: 18, height: 26, borderRadius: 2 },
  logoStarWars: { width: 36, height: 36, borderRadius: 2 },
  pubTextWrap: { position: 'absolute', top: 10, left: 10, right: 10 },
  pubText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige, lineHeight: 18 },
});

interface SearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onHeroPress: (id: string) => void;
}

export function SearchSheet({ visible, onClose, onHeroPress }: SearchSheetProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = useState(false);
  const [allHeroes, setAllHeroes] = useState<HeroSearchResult[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [query, setQuery] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const cardWidth = (SCREEN_WIDTH - H_PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const debouncedQuery = useDebounce(query, 150);

  // Load all heroes once on first mount
  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAllHeroes)
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, []);

  // Slide in/out
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => inputRef.current?.focus());
    } else {
      Animated.spring(slideAnim, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          setQuery('');
          setPublisherFilter('All');
        }
      });
    }
  }, [visible]);

  const filteredHeroes = useMemo(() => {
    let list =
      publisherFilter === 'All'
        ? allHeroes
        : allHeroes.filter((h) => {
            const pub = (h.publisher ?? '').toLowerCase();
            if (publisherFilter === 'Marvel') return pub.includes('marvel');
            if (publisherFilter === 'DC') return pub.includes('dc');
            return !pub.includes('marvel') && !pub.includes('dc');
          });
    return debouncedQuery.trim() ? rankResults(list, debouncedQuery) : list;
  }, [allHeroes, debouncedQuery, publisherFilter]);

  const displayedHeroes = filteredHeroes.slice(0, DISPLAY_LIMIT);

  const handlePress = useCallback(
    (id: string) => {
      onHeroPress(id);
    },
    [onHeroPress],
  );

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.sheetInner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Handle */}
          <View style={styles.handle} />
          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color="rgba(245,235,220,0.45)" />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Hero, villain, or real name…"
              placeholderTextColor="rgba(245,235,220,0.35)"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
              </TouchableOpacity>
            )}
          </View>
          {/* Publisher pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}
            style={styles.pillsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {PUBLISHER_PILLS.map((pill) => {
              const active = publisherFilter === pill;
              return (
                <TouchableOpacity
                  key={pill}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setPublisherFilter(pill)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{pill}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Results */}
          {loadingAll ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>Loading heroes…</Text>
            </View>
          ) : displayedHeroes.length === 0 ? (
            <View style={styles.center}>
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
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
              ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
              renderItem={({ item }) => (
                <PortraitCard
                  item={item}
                  cardWidth={cardWidth}
                  onPress={() => handlePress(item.id)}
                  disabled={false}
                />
              )}
            />
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,45,51,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.88,
    backgroundColor: COLORS.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetInner: { flex: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,235,220,0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,235,220,0.1)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
  },
  pillsScroll: { flexGrow: 0, height: 44, marginBottom: 4 },
  pillsContainer: { paddingHorizontal: 16, paddingVertical: 2, gap: 8, alignItems: 'center' },
  pill: {
    height: 34,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(245,235,220,0.2)',
  },
  pillActive: { backgroundColor: COLORS.beige, borderColor: COLORS.beige },
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.5)' },
  pillTextActive: { color: COLORS.navy },
  grid: { paddingHorizontal: H_PAD, paddingBottom: 40 },
  gridRow: { gap: GAP },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: 'rgba(245,235,220,0.5)' },
  emptyHeadline: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: 'rgba(245,235,220,0.55)' },
});
```

- [ ] **Step 8.2: Commit**

```bash
git add src/components/SearchSheet.tsx
git commit -m "feat(ui): add SearchSheet — slide-up modal with all search logic"
```

---

## Task 9: Update HomeSkeleton

**Files:**
- Modify: `src/components/skeletons/HomeSkeleton.tsx`

- [ ] **Step 9.1: Rewrite HomeSkeleton to match the new layout**

Replace the entire contents of `src/components/skeletons/HomeSkeleton.tsx`:

```typescript
// src/components/skeletons/HomeSkeleton.tsx
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_HEIGHT = 300;
const CARD_GAP = 12;

function SpotlightSkeleton({ insetTop }: { insetTop: number }) {
  const height = insetTop + Math.round(SCREEN_HEIGHT * 0.42);
  return <Skeleton width="100%" height={height} borderRadius={0} />;
}

function ThumbRowSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Skeleton width="20%" height={10} borderRadius={4} />
        <Skeleton width="35%" height={22} borderRadius={6} style={styles.titleSkeleton} />
      </View>
      <View style={styles.thumbRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={90} height={58} borderRadius={8} />
        ))}
      </View>
    </View>
  );
}

function PortraitRowSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Skeleton width="40%" height={22} borderRadius={6} />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.portraitRow}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={36} />
        ))}
      </ScrollView>
    </View>
  );
}

interface HomeSkeletonProps {
  insets: { top: number };
}

export function HomeSkeleton({ insets }: HomeSkeletonProps) {
  return (
    <SkeletonProvider>
      <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false}>
        <SpotlightSkeleton insetTop={insets.top} />
        <ThumbRowSkeleton />
        <PortraitRowSkeleton />
        <PortraitRowSkeleton />
        <PortraitRowSkeleton />
      </ScrollView>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 4 },
  sectionHeader: { paddingHorizontal: 15, marginBottom: 10, gap: 4 },
  titleSkeleton: { marginTop: 2 },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 15,
  },
  portraitRow: {
    paddingHorizontal: 15,
    gap: CARD_GAP,
  },
});
```

- [ ] **Step 9.2: Commit**

```bash
git add src/components/skeletons/HomeSkeleton.tsx
git commit -m "feat(ui): update HomeSkeleton for spotlight + row layout"
```

---

## Task 10: Rewrite app/(tabs)/index.tsx

**Files:**
- Rewrite: `app/(tabs)/index.tsx`

- [ ] **Step 10.1: Rewrite the file**

Replace the entire contents of `app/(tabs)/index.tsx`:

```typescript
// app/(tabs)/index.tsx — Home screen: spotlight + curated/personal carousels
import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { HomeSkeleton } from '../../src/components/skeletons/HomeSkeleton';
import { SpotlightBanner } from '../../src/components/home/SpotlightBanner';
import { HomeHeroRow, type RowHero } from '../../src/components/home/HomeHeroRow';
import { SearchSheet } from '../../src/components/SearchSheet';
import {
  getHeroesByCategory,
  getAntiHeroes,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  type Hero,
} from '../../src/lib/db/heroes';
import { getUserFavouriteHeroes, type FavouriteHero } from '../../src/lib/db/favourites';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';

const SPOTLIGHT_POOL = 5; // how many popular heroes cycle in the spotlight

interface HomeData {
  popular: Hero[];
  villain: Hero[];
  xmen: Hero[];
  antiHeroes: Hero[];
  marvel: Hero[];
  dc: Hero[];
  strongest: Hero[];
  mostIntelligent: Hero[];
}

function toRowHero(h: Hero | FavouriteHero): RowHero {
  return { id: h.id, name: h.name, image_url: h.image_url, portrait_url: h.portrait_url };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [data, setData] = useState<HomeData | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [searchVisible, setSearchVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Load all curated data in parallel
  useEffect(() => {
    Promise.all([
      getHeroesByCategory(),
      getAntiHeroes(),
      getHeroesByPublisher('marvel'),
      getHeroesByPublisher('dc'),
      getHeroesByStatRanking('strength'),
      getHeroesByStatRanking('intelligence'),
    ]).then(([cats, antiHeroes, marvel, dc, strongest, mostIntelligent]) => {
      setData({
        popular: cats.popular,
        villain: cats.villain,
        xmen: cats.xmen,
        antiHeroes,
        marvel,
        dc,
        strongest,
        mostIntelligent,
      });
    });
    // Errors are silently ignored — HomeSkeleton stays visible until data resolves
  }, []);

  // Load personal rows when user is available
  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id).then(setRecentlyViewed).catch(() => {});
    getUserFavouriteHeroes(user.id).then(setFavourites).catch(() => {});
  }, [user?.id]);

  // Auto-advance spotlight every 6 seconds through the first SPOTLIGHT_POOL popular heroes
  useEffect(() => {
    if (!data?.popular.length) return;
    const total = Math.min(SPOTLIGHT_POOL, data.popular.length);
    if (total <= 1) return;
    const timer = setInterval(() => {
      setSpotlightIndex((i) => (i + 1) % total);
    }, 6000);
    return () => clearInterval(timer);
  }, [data?.popular]);

  const handlePress = useCallback(
    (item: { id: string }) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      router.push(`/character/${item.id}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating],
  );

  const spotlightHero = data?.popular[spotlightIndex] ?? null;
  const spotlightTotal = data ? Math.min(SPOTLIGHT_POOL, data.popular.length) : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {!data ? (
        <HomeSkeleton insets={insets} />
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.content}
        >
          {spotlightHero && (
            <SpotlightBanner
              hero={spotlightHero}
              index={spotlightIndex}
              total={spotlightTotal}
              insetTop={insets.top}
              onSearchPress={() => setSearchVisible(true)}
              onHeroPress={() => handlePress(spotlightHero)}
            />
          )}

          {/* Personal rows — hidden until data exists */}
          {recentlyViewed.length > 0 && (
            <HomeHeroRow
              label="Personal"
              title="Jump Back In"
              heroes={recentlyViewed.map(toRowHero)}
              variant="thumb"
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {favourites.length > 0 && (
            <HomeHeroRow
              label="Personal"
              title="Your Favourites"
              heroes={favourites.map(toRowHero)}
              variant="portrait"
              onPress={handlePress}
              disabled={navigating}
            />
          )}

          {/* Curated rows */}
          {data.popular.length > 0 && (
            <HomeHeroRow
              title="Popular"
              heroes={data.popular.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.villain.length > 0 && (
            <HomeHeroRow
              title="Villains"
              heroes={data.villain.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.xmen.length > 0 && (
            <HomeHeroRow
              title="X-Men"
              heroes={data.xmen.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.antiHeroes.length > 0 && (
            <HomeHeroRow
              title="Anti-Heroes"
              heroes={data.antiHeroes.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.marvel.length > 0 && (
            <HomeHeroRow
              title="Marvel Universe"
              heroes={data.marvel.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.dc.length > 0 && (
            <HomeHeroRow
              title="DC Universe"
              heroes={data.dc.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.strongest.length > 0 && (
            <HomeHeroRow
              title="Strongest Heroes"
              heroes={data.strongest.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.mostIntelligent.length > 0 && (
            <HomeHeroRow
              title="Most Intelligent"
              heroes={data.mostIntelligent.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
        </ScrollView>
      )}

      <SearchSheet
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onHeroPress={(id) => {
          setSearchVisible(false);
          handlePress({ id });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { paddingBottom: 120 },
});
```

- [ ] **Step 10.2: Run the full test suite**

```bash
bun run test:ci
```

Expected: `PASS` — all tests green. The screen has no unit tests (per project convention), but the underlying DB functions and hooks are all covered.

- [ ] **Step 10.3: Start the dev server and test on device/simulator**

```bash
bun start
```

Verify on iOS simulator:
- Status bar is light (white icons) over the spotlight image
- Spotlight banner fills top ~45% of screen, extends behind status bar
- Dots appear and auto-advance every 6s
- Tapping the spotlight navigates to the character screen
- Tapping 🔍 opens the search sheet with slide-up animation
- Search sheet: typing filters heroes in the grid
- Publisher pills filter correctly
- Swiping down the sheet closes it
- Curated rows (Popular, Villains, etc.) render below the spotlight
- Personal rows hidden for a fresh user (no history/favourites yet)
- After visiting a character screen, "Jump Back In" row appears on return to home

- [ ] **Step 10.4: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: home screen takeover — spotlight, 10 carousels, search modal"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Full-bleed spotlight behind status bar — Task 6 + 10
- [x] Spotlight rotates through popular heroes — Task 10 (auto-advance)
- [x] Dot indicator — Task 6
- [x] Search icon → modal sheet — Task 8 + 10
- [x] Jump Back In row (recently viewed) — Tasks 1–4 + 10
- [x] Your Favourites row — Task 10 (uses existing `getUserFavouriteHeroes`)
- [x] Popular, Villains, X-Men rows — Task 10
- [x] Anti-Heroes row — Tasks 3 + 10
- [x] Marvel Universe, DC Universe rows — Tasks 3 + 10
- [x] Strongest Heroes, Most Intelligent rows — Tasks 3 + 10
- [x] Personal rows hidden when empty — Task 10 (conditional render)
- [x] Supabase `user_view_history` table — Task 1
- [x] RLS on view history — Task 1
- [x] Record view on character screen open — Task 4
- [x] Landscape thumb cards for personal rows — Task 5
- [x] Portrait HeroCard for curated rows — Task 7
- [x] Updated HomeSkeleton — Task 9
- [x] All tests pass — Tasks 2, 3
