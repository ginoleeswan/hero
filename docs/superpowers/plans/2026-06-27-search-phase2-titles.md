# Smarter Search Phase 2 (Titles) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Films & Shows" section to search (palette + results page) that surfaces matching titles from the `titles` table.

**Architecture:** Extends Phase 1's client-side aggregation. A new `searchTitles()` runs one `ILIKE` query ordered by popularity; `useUnifiedSearch()` runs it alongside universes + heroes and returns a third section.

**Tech Stack:** TypeScript, React Native (web target), Supabase/PostgREST, jest-expo.

**Depends on:** Phase 1 plan (`useUnifiedSearch`, `UniverseChip`, sectioned palette + results page) must be merged first.

## Global Constraints

- yarn only; `yarn test:ci`. No `any`. Functional components. `StyleSheet.create`.
- DB access via `src/lib/db/` only. PostgREST has a 1000-row cap — always `.limit()`.
- Fonts: never `Flame-Bold`. Web surfaces under `src/components/web/`.
- `titles` columns available (verified): `id` (text, `<source>:<external_id>`), `title`, `media_type` (`film|tv|game`), `year` (int), `poster_url`, `popularity` (numeric).

---

### Task 1: `searchTitles()` + `TitleSearchResult`

**Files:**
- Modify: `src/lib/db/titles.ts` (add export at end)
- Test: `__tests__/lib/db/titles.test.ts` (create)

**Interfaces:**
- Produces:
  - `interface TitleSearchResult { id: string; title: string; media_type: string; year: number | null; poster_url: string | null }`
  - `function searchTitles(query: string, limit?: number): Promise<TitleSearchResult[]>`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/db/titles.test.ts
import { searchTitles } from '../../../src/lib/db/titles';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

function mockTitleQuery(rows: unknown, error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data: rows, error });
  const order = jest.fn(() => ({ limit }));
  const ilike = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ ilike }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, ilike, order, limit };
}

describe('searchTitles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] for an empty query without hitting the DB', async () => {
    mockTitleQuery([]);
    expect(await searchTitles('   ')).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries titles by ILIKE and maps the rows', async () => {
    const m = mockTitleQuery([
      { id: 'tmdb:1726', title: 'Iron Man', media_type: 'film', year: 2008, poster_url: 'p.jpg' },
    ]);
    const out = await searchTitles('iron man', 6);
    expect(supabase.from).toHaveBeenCalledWith('titles');
    expect(m.ilike).toHaveBeenCalledWith('title', '%iron man%');
    expect(m.limit).toHaveBeenCalledWith(6);
    expect(out[0]).toEqual({
      id: 'tmdb:1726',
      title: 'Iron Man',
      media_type: 'film',
      year: 2008,
      poster_url: 'p.jpg',
    });
  });

  it('degrades to [] on error', async () => {
    mockTitleQuery(null, { message: 'boom' });
    expect(await searchTitles('x')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/titles.test.ts`
Expected: FAIL — `searchTitles` is not exported.

- [ ] **Step 3: Add the implementation to `src/lib/db/titles.ts`**

Append:

```ts
export interface TitleSearchResult {
  id: string;
  title: string;
  media_type: string;
  year: number | null;
  poster_url: string | null;
}

/**
 * Title search for the unified search surface. Straight ILIKE on the title,
 * ranked by popularity (most-known first). Empty query short-circuits — titles
 * have no browse-all in search. Degrades to [] so a DB hiccup never blanks the
 * other result sections.
 */
export async function searchTitles(query: string, limit = 6): Promise<TitleSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('titles')
    .select('id, title, media_type, year, poster_url')
    .ilike('title', `%${q}%`)
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.warn('[searchTitles] error:', error.message);
    return [];
  }
  return (data ?? []) as TitleSearchResult[];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/titles.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/titles.ts __tests__/lib/db/titles.test.ts
git commit -m "feat(search): searchTitles ILIKE query for unified search"
```

---

### Task 2: Add titles to `useUnifiedSearch`

**Files:**
- Modify: `src/hooks/useUnifiedSearch.ts`
- Modify: `__tests__/hooks/useUnifiedSearch.test.tsx`

**Interfaces:**
- Consumes: `searchTitles`, `TitleSearchResult` (Task 1).
- Produces (extended return): `{ universes, heroes, titles: TitleSearchResult[], loading, resultCount }`.

`searchTitles` is async, so the hook needs its own debounced effect (mirroring
`useHeroSearch`'s shape) rather than a `useMemo`.

- [ ] **Step 1: Add the failing test case**

Add to `__tests__/hooks/useUnifiedSearch.test.tsx`:

```tsx
import { searchTitles } from '../../src/lib/db/titles';
// add to the existing jest.mock block region:
jest.mock('../../src/lib/db/titles', () => ({ searchTitles: jest.fn() }));
const mockSearchTitles = searchTitles as jest.MockedFunction<typeof searchTitles>;

// inside describe('useUnifiedSearch'):
it('populates the titles section', async () => {
  mockUseHeroSearch.mockReturnValue({ results: [], loading: false, hasCriteria: true });
  mockSearchTitles.mockResolvedValue([
    { id: 'tmdb:1', title: 'The Boys', media_type: 'tv', year: 2019, poster_url: null },
  ]);
  const { result } = renderHook(() => useUnifiedSearch('the boys'));
  const { waitFor } = require('@testing-library/react-native');
  await waitFor(() => expect(result.current.titles).toHaveLength(1));
  expect(result.current.titles[0].title).toBe('The Boys');
});
```

Also add `mockSearchTitles.mockResolvedValue([]);` to the existing `beforeEach`
so the prior tests don't see undefined.

- [ ] **Step 2: Run to verify the new test fails**

Run: `yarn test:ci __tests__/hooks/useUnifiedSearch.test.tsx`
Expected: FAIL — `result.current.titles` is undefined.

- [ ] **Step 3: Extend the hook**

Rewrite `src/hooks/useUnifiedSearch.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import { searchUniverses, type UniverseResult } from '../lib/db/universes';
import { searchTitles, type TitleSearchResult } from '../lib/db/titles';
import { useHeroSearch } from './useHeroSearch';
import type { HeroSearchResult } from '../lib/db/heroes';

export interface UnifiedSearch {
  universes: UniverseResult[];
  heroes: HeroSearchResult[];
  titles: TitleSearchResult[];
  loading: boolean;
  resultCount: number;
}

export function useUnifiedSearch(query: string, heroLimit = 100): UnifiedSearch {
  const trimmed = query.trim();
  const universes = useMemo(() => searchUniverses(trimmed, 3), [trimmed]);
  const { results: heroes, loading } = useHeroSearch(query, 'All', heroLimit);

  const [titles, setTitles] = useState<TitleSearchResult[]>([]);
  useEffect(() => {
    if (!trimmed) {
      setTitles([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchTitles(trimmed, 6);
      if (!cancelled) setTitles(res);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  return { universes, heroes, titles, loading, resultCount: heroes.length };
}
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `yarn test:ci __tests__/hooks/useUnifiedSearch.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUnifiedSearch.ts __tests__/hooks/useUnifiedSearch.test.tsx
git commit -m "feat(search): titles in useUnifiedSearch"
```

---

### Task 3: `TitleResultRow` component (web)

**Files:**
- Create: `src/components/web/search/TitleResultRow.tsx`

**Interfaces:**
- Consumes: `TitleSearchResult` (Task 1), `COLORS`.
- Produces: `function TitleResultRow({ title, onPress }: { title: TitleSearchResult; onPress: () => void }): JSX.Element`

No unit test (component render). Typecheck-verified.

- [ ] **Step 1: Write the component**

```tsx
// src/components/web/search/TitleResultRow.tsx
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { TitleSearchResult } from '../../../lib/db/titles';

const MEDIA_LABEL: Record<string, string> = { film: 'Film', tv: 'TV', game: 'Game' };

export function TitleResultRow({ title, onPress }: { title: TitleSearchResult; onPress: () => void }) {
  const meta = [title.year ?? null, MEDIA_LABEL[title.media_type] ?? title.media_type]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [styles.row, hovered && (styles.rowHover as object)] as object
      }
    >
      <View style={styles.poster as object}>
        {title.poster_url ? (
          <Image source={{ uri: title.poster_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
      </View>
      <View style={styles.text}>
        <Text style={styles.title as object} numberOfLines={1}>
          {title.title}
        </Text>
        <Text style={styles.meta as object}>{meta}</Text>
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
    paddingVertical: 8,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: { backgroundColor: 'rgba(245,235,220,0.06)' } as object,
  poster: {
    width: 30,
    height: 44,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.12)',
  } as object,
  text: { flexDirection: 'column' },
  title: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige } as object,
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  } as object,
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `yarn tsc --noEmit`
Expected: PASS.

```bash
git add src/components/web/search/TitleResultRow.tsx
git commit -m "feat(search): TitleResultRow component"
```

---

### Task 4: Render the "Films & Shows" section in the palette

**Files:**
- Modify: `src/components/web/search/SearchDropdownContent.tsx`

- [ ] **Step 1: Consume titles and render the section**

In `SearchDropdownContent`, destructure `titles` from `useUnifiedSearch`, import
`TitleResultRow`, and add a handler:

```tsx
  const { universes, heroes, titles, loading, resultCount } = useUnifiedSearch(query);
```
```tsx
  const handleTitlePress = (id: string) => {
    addSearch(query);
    close();
    router.push(`/title/${id}` as Parameters<typeof router.push>[0]);
  };
```

After the `<SuggestionsList .../>` in the non-idle return, add:

```tsx
      {titles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel as object}>Films & Shows</Text>
          {titles.slice(0, 3).map((t) => (
            <TitleResultRow key={t.id} title={t} onPress={() => handleTitlePress(t.id)} />
          ))}
        </View>
      )}
```

Add `import { TitleResultRow } from './TitleResultRow';`.

- [ ] **Step 2: Extend the keyboard nav item list (if Phase 1 Task 6 landed)**

In the `navItems` array, append titles after heroes:

```tsx
        ...titles.slice(0, 3).map((t) => ({ kind: 'title', id: t.id }) as NavItem),
```

Extend the `NavItem` union:

```tsx
export type NavItem =
  | { kind: 'universe'; slug: string }
  | { kind: 'hero'; id: string }
  | { kind: 'title'; id: string };
```

And in `SearchPalette.tsx`'s Enter handler add a branch:

```tsx
        } else if (item.kind === 'title') {
          router.push(`/title/${item.id}` as Parameters<typeof router.push>[0]);
        }
```

- [ ] **Step 3: Typecheck + full suite**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/web/search/SearchDropdownContent.tsx src/components/web/search/SearchPalette.tsx
git commit -m "feat(search): Films & Shows section in palette"
```

---

### Task 5: Render the "Films & Shows" section on the results page

**Files:**
- Modify: `app/(tabs)/search/index.web.tsx`

- [ ] **Step 1: Consume titles + render below the hero grid**

Destructure `titles` from `useUnifiedSearch`, import `TitleResultRow`. After the
hero grid `<View style={gridStyle}>…</View>` (and before the `capped` hint),
insert:

```tsx
          {titles.length > 0 && (
            <View style={styles.titlesSection}>
              <Text style={styles.idleLabel as object}>Films & Shows</Text>
              {titles.map((t) => (
                <View key={t.id} style={styles.universeChipWrap as object}>
                  <TitleResultRow
                    title={t}
                    onPress={() => router.push(`/title/${t.id}` as Parameters<typeof router.push>[0])}
                  />
                </View>
              ))}
            </View>
          )}
```

Add `import { TitleResultRow } from '../../../src/components/web/search/TitleResultRow';`
and the style:

```tsx
  titlesSection: { paddingTop: 20, gap: 6 } as object,
```

- [ ] **Step 2: Typecheck + full suite**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/search/index.web.tsx"
git commit -m "feat(search): Films & Shows section on results page"
```

---

## Self-Review

- **Spec coverage:** `searchTitles` ILIKE + popularity order + caps (Task 1) ✓; folded into `useUnifiedSearch` as a third parallel query (Task 2) ✓; "Films & Shows" section below heroes in palette (Task 4) + results page (Task 5) ✓; degrades to [] on error (Task 1) ✓; routes to `/title/[id]` ✓.
- **Type consistency:** `TitleSearchResult` identical across tasks; `NavItem` union extended once (Task 4) and matched in the palette Enter branch.
- **Dependency note:** Task 4 Step 2 assumes Phase 1 Task 6 (keyboard nav) merged. If it was deferred, skip Step 2 — the section still renders and is clickable.
