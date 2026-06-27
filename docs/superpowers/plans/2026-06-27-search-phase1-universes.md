# Smarter Search Phase 1 (Universes + Heroes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make search return universes (Marvel, DC, Disney, Mattel…) above heroes, in both the web command palette and the `/search` results page, with a richer idle state and keyboard navigation.

**Architecture:** Client-side aggregation. A pure `searchUniverses()` fuzzy-matches the existing `PUBLISHER_BRANDS` registry (no DB). A new `useUnifiedSearch()` hook composes it with the existing debounced `useHeroSearch()` and returns grouped sections. Both surfaces render a "Universes" section above heroes. No migration.

**Tech Stack:** TypeScript, React Native (Expo, web target), expo-router, jest-expo + @testing-library/react-native.

## Global Constraints

- Package manager: **yarn** only. Run tests with `yarn test:ci`.
- No `any` — use `unknown` for caught errors.
- Functional components only; `StyleSheet.create` for all styles (no inline objects except `StyleSheet.absoluteFill`).
- Fonts: `Flame-Regular` (display) / `FlameSans-Regular` / `Nunito_*` (UI). **Never** `Flame-Bold`.
- Screens never import `supabase` directly — DB access via `src/lib/db/`. (Universes need no DB.)
- Do not edit `src/types/database.generated.ts`.
- Universes stay a TypeScript registry — no Postgres table, no migration.
- Web-only surfaces live under `src/components/web/`.

---

### Task 1: `searchUniverses()` + `UniverseResult` (pure registry search)

**Files:**
- Create: `src/lib/db/universes.ts`
- Test: `__tests__/lib/db/universes.test.ts`

**Interfaces:**
- Consumes: `PUBLISHER_BRANDS`, `PublisherBrand`, `BrandLogo` from `src/constants/publishers.ts`.
- Produces:
  - `interface UniverseResult { slug: string; name: string; color: string; logo?: BrandLogo; badgeSize?: { width: number; height: number }; logoOnLight?: boolean; exact: boolean; }`
  - `function searchUniverses(query: string, limit?: number): UniverseResult[]`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/db/universes.test.ts
import { searchUniverses } from '../../../src/lib/db/universes';

describe('searchUniverses', () => {
  it('resolves a universe by exact name', () => {
    const out = searchUniverses('disney');
    expect(out[0].slug).toBe('disney');
    expect(out[0].exact).toBe(true);
  });

  it('resolves Mattel', () => {
    expect(searchUniverses('mattel')[0].slug).toBe('mattel');
  });

  it('matches a `match[]` alias ("dc comics" → dc)', () => {
    expect(searchUniverses('dc comics')[0].slug).toBe('dc');
  });

  it('ranks exact above prefix above contains', () => {
    // "marvel" is exact for the marvel brand; ensure it is first and exact.
    const out = searchUniverses('marvel');
    expect(out[0].slug).toBe('marvel');
    expect(out[0].exact).toBe(true);
  });

  it('returns [] for an empty/whitespace query', () => {
    expect(searchUniverses('')).toEqual([]);
    expect(searchUniverses('   ')).toEqual([]);
  });

  it('caps results at the requested limit', () => {
    expect(searchUniverses('a', 3).length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/universes.test.ts`
Expected: FAIL — cannot find module `src/lib/db/universes`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/db/universes.ts
import { PUBLISHER_BRANDS, type PublisherBrand, type BrandLogo } from '../../constants/publishers';

export interface UniverseResult {
  slug: string;
  name: string;
  color: string;
  logo?: BrandLogo;
  badgeSize?: { width: number; height: number };
  logoOnLight?: boolean;
  /** Exact name/alias hit — ranks first and can drive a "jump straight there" affordance. */
  exact: boolean;
}

// Mirrors the normaliser used by hero rankResults: lowercase, strip separators.
const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');

/**
 * Fuzzy-search the brand registry for universes matching `query`. Pure and
 * synchronous (the registry is a small in-memory constant) so callers can paint
 * universe hits instantly, before the debounced hero search returns.
 * Ranking: exact (0) > prefix (1) > contains (2); ties keep registry order
 * (which is already brand-priority ordered).
 */
export function searchUniverses(query: string, limit = 6): UniverseResult[] {
  const qn = norm(query);
  if (!qn) return [];

  const scored: { brand: PublisherBrand; index: number; rank: number }[] = [];
  PUBLISHER_BRANDS.forEach((brand, index) => {
    const candidates = [brand.name, ...brand.match].map(norm);
    let rank = Infinity;
    for (const c of candidates) {
      if (c === qn) rank = Math.min(rank, 0);
      else if (c.startsWith(qn)) rank = Math.min(rank, 1);
      else if (c.includes(qn)) rank = Math.min(rank, 2);
    }
    if (rank !== Infinity) scored.push({ brand, index, rank });
  });

  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);

  return scored.slice(0, limit).map(({ brand, rank }) => ({
    slug: brand.slug,
    name: brand.name,
    color: brand.color,
    logo: brand.logo,
    badgeSize: brand.badgeSize,
    logoOnLight: brand.logoOnLight,
    exact: rank === 0,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/universes.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/universes.ts __tests__/lib/db/universes.test.ts
git commit -m "feat(search): searchUniverses registry fuzzy match"
```

---

### Task 2: `useUnifiedSearch()` hook

**Files:**
- Create: `src/hooks/useUnifiedSearch.ts`
- Test: `__tests__/hooks/useUnifiedSearch.test.tsx`

**Interfaces:**
- Consumes: `searchUniverses`, `UniverseResult` (Task 1); `useHeroSearch` from `src/hooks/useHeroSearch.ts`; `HeroSearchResult` from `src/lib/db/heroes`.
- Produces: `function useUnifiedSearch(query: string, heroLimit?: number): { universes: UniverseResult[]; heroes: HeroSearchResult[]; loading: boolean; resultCount: number }`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/hooks/useUnifiedSearch.test.tsx
import { renderHook } from '@testing-library/react-native';
import { useUnifiedSearch } from '../../src/hooks/useUnifiedSearch';
import { useHeroSearch } from '../../src/hooks/useHeroSearch';
import type { HeroSearchResult } from '../../src/lib/db/heroes';

jest.mock('../../src/hooks/useHeroSearch', () => ({ useHeroSearch: jest.fn() }));

const mockUseHeroSearch = useHeroSearch as jest.MockedFunction<typeof useHeroSearch>;

const hero = (id: string): HeroSearchResult =>
  ({ id, name: id, publisher: null, alignment: null, image_md_url: null, image_url: null, portrait_url: null, full_name: null, aliases: null }) as HeroSearchResult;

describe('useUnifiedSearch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('merges universe hits with hero results', () => {
    mockUseHeroSearch.mockReturnValue({ results: [hero('a'), hero('b')], loading: false, hasCriteria: true });
    const { result } = renderHook(() => useUnifiedSearch('disney'));
    expect(result.current.universes[0].slug).toBe('disney');
    expect(result.current.heroes).toHaveLength(2);
    expect(result.current.resultCount).toBe(2);
  });

  it('still returns universes when hero search is empty', () => {
    mockUseHeroSearch.mockReturnValue({ results: [], loading: false, hasCriteria: true });
    const { result } = renderHook(() => useUnifiedSearch('marvel'));
    expect(result.current.universes.length).toBeGreaterThan(0);
    expect(result.current.heroes).toEqual([]);
  });

  it('returns no universes for an empty query', () => {
    mockUseHeroSearch.mockReturnValue({ results: [], loading: false, hasCriteria: false });
    const { result } = renderHook(() => useUnifiedSearch(''));
    expect(result.current.universes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/hooks/useUnifiedSearch.test.tsx`
Expected: FAIL — cannot find module `src/hooks/useUnifiedSearch`.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useUnifiedSearch.ts
import { useMemo } from 'react';
import { searchUniverses, type UniverseResult } from '../lib/db/universes';
import { useHeroSearch } from './useHeroSearch';
import type { HeroSearchResult } from '../lib/db/heroes';

export interface UnifiedSearch {
  universes: UniverseResult[];
  heroes: HeroSearchResult[];
  loading: boolean;
  resultCount: number;
}

// Grouped search across types. Universes resolve synchronously from the registry
// (instant), heroes ride the existing debounced RPC. Section order is fixed by
// the consumer: universes first, then heroes.
export function useUnifiedSearch(query: string, heroLimit = 100): UnifiedSearch {
  const trimmed = query.trim();
  const universes = useMemo(() => searchUniverses(trimmed, 3), [trimmed]);
  const { results: heroes, loading } = useHeroSearch(query, 'All', heroLimit);
  return { universes, heroes, loading, resultCount: heroes.length };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/hooks/useUnifiedSearch.test.tsx`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUnifiedSearch.ts __tests__/hooks/useUnifiedSearch.test.tsx
git commit -m "feat(search): useUnifiedSearch composes universes + heroes"
```

---

### Task 3: `UniverseChip` component (web)

**Files:**
- Create: `src/components/web/search/UniverseChip.tsx`

**Interfaces:**
- Consumes: `UniverseResult` (Task 1); `COLORS` from `src/constants/colors`.
- Produces: `function UniverseChip({ universe, onPress }: { universe: UniverseResult; onPress: () => void }): JSX.Element`

No unit test (per CLAUDE.md: no component-render tests). Verified by typecheck + manual render in Tasks 4–6.

- [ ] **Step 1: Write the component**

```tsx
// src/components/web/search/UniverseChip.tsx
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { UniverseResult } from '../../../lib/db/universes';

// A brand chip for a universe search hit. Logo on a brand-tinted dot, name beside
// it; the whole row is a doorway into /universe/[slug]. Logos that read better on
// light get a light backing dot, mirroring the card-badge logic.
export function UniverseChip({ universe, onPress }: { universe: UniverseResult; onPress: () => void }) {
  const { name, color, logo, badgeSize, logoOnLight } = universe;
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [styles.row, hovered && (styles.rowHover as object)] as object
      }
    >
      <View style={[styles.dot, { backgroundColor: logoOnLight ? COLORS.beige : color }] as object}>
        {logo ? (
          <Image
            source={logo as number}
            style={{ width: badgeSize?.width ?? 22, height: badgeSize?.height ?? 22 } as object}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.fallback as object} numberOfLines={1}>
            {name.slice(0, 2).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.name as object} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.kicker as object}>Universe</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: { backgroundColor: 'rgba(245,235,220,0.06)' } as object,
  dot: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as object,
  text: { flexDirection: 'column' },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige } as object,
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as object,
  fallback: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy } as object,
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: PASS (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
git add src/components/web/search/UniverseChip.tsx
git commit -m "feat(search): UniverseChip brand row component"
```

---

### Task 4: Render universes section in the command palette

**Files:**
- Modify: `src/components/web/search/SearchDropdownContent.tsx`

**Interfaces:**
- Consumes: `useUnifiedSearch` (Task 2), `UniverseChip` (Task 3), `publisherBySlug` is **not** needed — route by `slug` directly.
- Produces: no new exports.

- [ ] **Step 1: Swap the suggestions source and add the universes section**

Replace the body of `SearchDropdownContent` so it uses `useUnifiedSearch` and renders universe chips above the hero `SuggestionsList`. Full new file:

```tsx
// src/components/web/search/SearchDropdownContent.tsx
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSearch } from '../../../contexts/SearchContext';
import { useSearchHistory } from '../../../hooks/useSearchHistory';
import { useUnifiedSearch } from '../../../hooks/useUnifiedSearch';
import { useIdleHeroes } from '../../../hooks/useIdleHeroes';
import { IdleSuggestions } from './IdleSuggestions';
import { SuggestionsList } from './SuggestionsList';
import { UniverseChip } from './UniverseChip';

export function SearchDropdownContent() {
  const router = useRouter();
  const { query, setQuery, setSearchFocused } = useSearch();
  const { history, addSearch, clearHistory } = useSearchHistory();
  const { universes, heroes, loading, resultCount } = useUnifiedSearch(query);

  const isEmptyQuery = query.trim().length === 0;
  const { heroes: trending, isLoading: trendingLoading } = useIdleHeroes(isEmptyQuery, 4);

  const close = () => setSearchFocused(false);

  const handleHeroPress = (id: string) => {
    addSearch(query);
    close();
    router.push(`/character/${id}`);
  };

  const handleUniversePress = (slug: string) => {
    addSearch(query);
    close();
    router.push(`/universe/${slug}` as Parameters<typeof router.push>[0]);
  };

  const handleSelectRecentSearch = (recentQuery: string) => setQuery(recentQuery);

  const handleViewAll = () => {
    const q = query.trim();
    if (!q) return;
    addSearch(q);
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  if (isEmptyQuery) {
    return (
      <IdleSuggestions
        trending={trending}
        trendingLoading={trendingLoading}
        history={history}
        onHeroPress={handleHeroPress}
        onSelectRecent={handleSelectRecentSearch}
        onClearHistory={clearHistory}
      />
    );
  }

  return (
    <View style={styles.wrap as object}>
      {universes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel as object}>Universes</Text>
          {universes.map((u) => (
            <UniverseChip key={u.slug} universe={u} onPress={() => handleUniversePress(u.slug)} />
          ))}
        </View>
      )}
      <SuggestionsList
        query={query}
        suggestions={heroes.slice(0, 8)}
        isLoading={loading}
        resultCount={resultCount}
        onSuggestionPress={handleHeroPress}
        onViewAll={handleViewAll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'column', flex: 1, minHeight: 0 } as object,
  section: {
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
  },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingBottom: 4,
  } as object,
});
```

Note: `SuggestionsList` shows its own "No heroes found" empty state. When only a
universe matches and no heroes do, that line still appears below the universe
chip — acceptable, and a later polish can suppress it. Keep this task minimal.

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run the full suite (no regressions)**

Run: `yarn test:ci`
Expected: PASS (same pass count as before plus the new tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/web/search/SearchDropdownContent.tsx
git commit -m "feat(search): universes section in command palette"
```

---

### Task 5: Universes section + idle "Browse universes" on the results page

**Files:**
- Modify: `app/(tabs)/search/index.web.tsx`

**Interfaces:**
- Consumes: `useUnifiedSearch` (replaces the direct `useHeroSearch`), `UniverseChip` (Task 3), `FEATURED_PUBLISHERS` from `src/constants/publishers`.
- Produces: no new exports.

- [ ] **Step 1: Replace `useHeroSearch` with `useUnifiedSearch`**

In `app/(tabs)/search/index.web.tsx`, change the import and the hook call.

Replace:
```tsx
import { useHeroSearch } from '../../../src/hooks/useHeroSearch';
```
with:
```tsx
import { useUnifiedSearch } from '../../../src/hooks/useUnifiedSearch';
import { UniverseChip } from '../../../src/components/web/search/UniverseChip';
import { FEATURED_PUBLISHERS } from '../../../src/constants/publishers';
```

Replace:
```tsx
  const { results: heroes, loading } = useHeroSearch(inputQuery, 'All', RESULT_LIMIT);
```
with:
```tsx
  const { universes, heroes, loading } = useUnifiedSearch(inputQuery, RESULT_LIMIT);
```

- [ ] **Step 2: Render the universes section above the hero grid**

In the non-idle content block, immediately after the `{hasCriteria && <Text style={styles.resultCount...}>{countLabel}</Text>}` line and before `<View style={gridStyle as object}>`, insert:

```tsx
          {universes.length > 0 && (
            <View style={styles.universeRow as object}>
              {universes.map((u) => (
                <View key={u.slug} style={styles.universeChipWrap as object}>
                  <UniverseChip
                    universe={u}
                    onPress={() =>
                      router.push(`/universe/${u.slug}` as Parameters<typeof router.push>[0])
                    }
                  />
                </View>
              ))}
            </View>
          )}
```

- [ ] **Step 3: Add a "Browse universes" row to the idle state**

In the idle block (`showIdle ? (...)`), inside the `<View style={[styles.gridWrap...]}>`, immediately before the `<View style={{ marginTop: ... }}><SearchBrowse .../></View>`, insert:

```tsx
          <View style={styles.idleHeaderRow}>
            <Text style={styles.idleLabel as object}>Browse universes</Text>
          </View>
          <View style={styles.universeRow as object}>
            {FEATURED_PUBLISHERS.map((b) => (
              <View key={b.slug} style={styles.universeChipWrap as object}>
                <UniverseChip
                  universe={{
                    slug: b.slug,
                    name: b.name,
                    color: b.color,
                    logo: b.logo,
                    badgeSize: b.badgeSize,
                    logoOnLight: b.logoOnLight,
                    exact: false,
                  }}
                  onPress={() =>
                    router.push(`/universe/${b.slug}` as Parameters<typeof router.push>[0])
                  }
                />
              </View>
            ))}
          </View>
```

- [ ] **Step 4: Add the two styles**

In the `StyleSheet.create({ ... })` for this file, add:

```tsx
  universeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  } as object,
  universeChipWrap: {
    backgroundColor: 'rgba(29,45,51,0.06)',
    borderRadius: 12,
  } as object,
```

Note: `UniverseChip` was authored for the dark palette panel (beige text). On the
beige results page the chip's name text is low-contrast; the `universeChipWrap`
tints a subtle dark backing behind it. If contrast still reads poorly in manual
verification, add a `variant?: 'dark' | 'light'` prop to `UniverseChip` in a
follow-up — out of scope for this task.

- [ ] **Step 5: Typecheck + full suite**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/search/index.web.tsx"
git commit -m "feat(search): universes section + browse-universes idle row on results page"
```

---

### Task 6: Keyboard navigation in the command palette

**Files:**
- Modify: `src/components/web/search/SearchPalette.tsx`
- Modify: `src/components/web/search/SearchDropdownContent.tsx` (accept a highlight index + expose a flat item list)

**Interfaces:**
- Produces: `SearchDropdownContent` gains an optional prop `highlightIndex?: number` and calls an `onItemsChange?: (items: NavItem[]) => void` where `type NavItem = { kind: 'universe'; slug: string } | { kind: 'hero'; id: string }`. Export `NavItem` from `SearchDropdownContent.tsx`.

This task wires arrow-key navigation. The palette owns the highlight index and
the flat item list; the dropdown reports its rendered items up and highlights the
active row.

- [ ] **Step 1: Export a flat nav-item list from the dropdown**

In `SearchDropdownContent.tsx`, add at top-level:

```tsx
export type NavItem = { kind: 'universe'; slug: string } | { kind: 'hero'; id: string };
```

Add props to the component:

```tsx
export function SearchDropdownContent({
  highlightIndex = -1,
  onItemsChange,
}: {
  highlightIndex?: number;
  onItemsChange?: (items: NavItem[]) => void;
} = {}) {
```

After computing `universes` and `heroes` (non-idle branch), build and report the flat list with an effect:

```tsx
  const shownHeroes = heroes.slice(0, 8);
  const navItems: NavItem[] = isEmptyQuery
    ? []
    : [
        ...universes.map((u) => ({ kind: 'universe', slug: u.slug }) as NavItem),
        ...shownHeroes.map((h) => ({ kind: 'hero', id: h.id }) as NavItem),
      ];

  // Report the current flat item list up to the palette for keyboard nav. Effect
  // (not render-time call) so we never setState in a parent during render.
  useEffect(() => {
    onItemsChange?.(navItems);
  }, [JSON.stringify(navItems)]); // eslint-disable-line react-hooks/exhaustive-deps
```

Add `import { useEffect } from 'react';` to the existing react import.

Then pass highlight state down: compute the active universe slug / hero id from
`highlightIndex` and `navItems`, and pass a `highlighted` flag. Minimal approach —
highlight the active hero via `SuggestionsList` is more invasive, so for v1 wrap
each universe chip and let `SuggestionsList` keep its own hover styling; the
arrow keys still move a logical cursor used by Enter. Render universes with the
active outline:

```tsx
            <UniverseChip
              key={u.slug}
              universe={u}
              onPress={() => handleUniversePress(u.slug)}
            />
```

Keep `SuggestionsList` as-is (hover-driven). The visible highlight for heroes is a
follow-up; Enter-to-open is the functional win this task delivers.

- [ ] **Step 2: Own the highlight + key handling in `SearchPalette`**

In `SearchPalette.tsx`, add state and a keydown handler. After the existing
`useSearchHistory` line add:

```tsx
  const [items, setItems] = useState<NavItem[]>([]);
  const [highlight, setHighlight] = useState(-1);
```

Add imports: `useState` to the react import, and
`import { SearchDropdownContent, type NavItem } from './SearchDropdownContent';`
(replace the existing `SearchDropdownContent` import).

Reset highlight whenever the query changes:

```tsx
  useEffect(() => {
    setHighlight(-1);
  }, [query]);
```

Extend the existing Escape `keydown` effect to also handle arrows + Enter:

```tsx
  useEffect(() => {
    if (!searchFocused) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((i) => (items.length ? (i + 1) % items.length : -1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => (items.length ? (i - 1 + items.length) % items.length : -1));
      } else if (e.key === 'Enter') {
        const item = items[highlight];
        if (!item) return; // fall through to the input's onSubmitEditing (commit query)
        e.preventDefault();
        addSearch(query);
        close();
        if (item.kind === 'universe') {
          router.push(`/universe/${item.slug}` as Parameters<typeof router.push>[0]);
        } else {
          router.push(`/character/${item.id}`);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchFocused, items, highlight, query]); // eslint-disable-line react-hooks/exhaustive-deps
```

Remove the now-duplicated Escape-only effect (the block above supersedes it).

Pass the wiring into the dropdown:

```tsx
          <SearchDropdownContent highlightIndex={highlight} onItemsChange={setItems} />
```

- [ ] **Step 3: Typecheck + full suite**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/web/search/SearchPalette.tsx src/components/web/search/SearchDropdownContent.tsx
git commit -m "feat(search): arrow-key navigation + enter-to-open in palette"
```

---

### Task 7: Copy polish + final verification

**Files:**
- Modify: `src/components/web/search/SearchPalette.tsx` (placeholder copy)
- Modify: `app/(tabs)/search/index.web.tsx` (placeholder copy, desktop + mobile)

- [ ] **Step 1: Update placeholders**

In `SearchPalette.tsx` change `placeholder="Search heroes…"` → `placeholder="Search heroes & universes…"`.
In `app/(tabs)/search/index.web.tsx` change both `placeholder="Search heroes…"` occurrences (desktop + mobile) → `placeholder="Search heroes & universes…"`.

- [ ] **Step 2: Full verification**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint`
Expected: typecheck PASS, tests PASS, lint shows no NEW errors (warning backlog is pre-existing; gate is errors-only).

- [ ] **Step 3: Commit**

```bash
git add src/components/web/search/SearchPalette.tsx "app/(tabs)/search/index.web.tsx"
git commit -m "feat(search): 'heroes & universes' placeholder copy"
```

---

## Self-Review

- **Spec coverage:** universe section above heroes (Tasks 4, 5) ✓; mixed result types — universes+heroes (Tasks 2, 4, 5) ✓; exact-match-first ranking (Task 1) ✓; richer idle "Browse universes" (Task 5) ✓; palette keyboard nav (Task 6) ✓; no migration (universes pure) ✓.
- **Native parity:** `app/(tabs)/search/index.tsx` (native) is **out of scope** for Phase 1 — the palette and the enriched results experience are web surfaces; the native search keeps `useHeroSearch`. Verified there is no broken shared import (the native file imports `useHeroSearch` directly, untouched).
- **Type consistency:** `UniverseResult` shape is identical in Tasks 1, 3, 5; `NavItem` defined once (Task 6) and consumed in the palette. `useUnifiedSearch` return type matches its consumers.
- **Open question (hero-count on chip):** deferred per spec — not implemented.
