# React Query Navigation Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make navigation to category (`/category/[slug]`) and character (`/character/[id]`) screens feel instant by introducing a TanStack Query data layer with caching, prefetch, and placeholder-from-cache, plus trimming the over-fetching category query.

**Architecture:** Introduce `@tanstack/react-query` as a shared client cache. Convert the two **native** screens' data fetching to query hooks. The category grid becomes an infinite query that selects only the columns the cards render and counts rows only on the first page. The character screen wraps `getHeroById` in a query whose `placeholderData` is read from the already-cached category list — so the name and portrait paint immediately on tap while the full row revalidates. Press handlers prefetch the detail row before navigating.

**Tech Stack:** Expo SDK 55, React Native 0.83, expo-router 4, Supabase, `@tanstack/react-query` v5, jest-expo.

**Out of scope (deliberately deferred):**
- The `.web.tsx` variants of these screens (web is a separate render path / desktop perf story). This plan only touches column-narrowing in the shared `getCategoryPage`, which is kept safe for web.
- The DB migration to make `ilike '%...%'` filters sargable, and background ComicVine enrichment. These are the deepest wins but independent — they belong in a **follow-up plan** (`2026-06-03-category-filter-indexing.md`).
- Offline cache persistence (AsyncStorage persister). In-memory cache only for v1.

---

## File Structure

| File | Responsibility | New/Modify |
| --- | --- | --- |
| `package.json` | Add `@tanstack/react-query` dependency | Modify |
| `app/_layout.tsx` | Wrap the app in `QueryClientProvider` | Modify |
| `src/lib/query/queryClient.ts` | The singleton `QueryClient` + default options | Create |
| `src/lib/query/keys.ts` | Typed query-key factory (single source of truth) | Create |
| `src/lib/query/heroCache.ts` | Pure cache helpers: `flattenCategoryPages`, `findCachedHero` | Create |
| `src/lib/query/heroQueries.ts` | Hooks: `useCategoryHeroes`, `useFeaturedHero`, `useHeroRow`; `prefetchHeroRow` | Create |
| `src/lib/db/heroes.ts:378` | `getCategoryPage`: narrow columns + optional `withCount` | Modify |
| `app/category/[slug].tsx` | Replace bespoke fetch state with query hooks; prefetch on press | Modify |
| `app/character/[id].tsx` | Source the hero row from `useHeroRow` (cached + placeholder paint) | Modify |
| `__tests__/lib/db/heroes.categoryPage.test.ts` | Add tests for column-narrowing + conditional count | Modify |
| `__tests__/lib/query/heroCache.test.ts` | Tests for the pure cache helpers | Create |

**Testing convention (from CLAUDE.md):** unit-test pure logic / DB query shaping with a mocked Supabase chain; **do not** test navigation or full-screen rendering. So Tasks touching `heroes.ts` and `heroCache.ts` are TDD; screen and hook wiring is verified by `yarn typecheck` + a manual run.

---

### Task 1: Install React Query and provide the client

**Files:**
- Modify: `package.json`
- Create: `src/lib/query/queryClient.ts`
- Modify: `app/_layout.tsx:73-80`

- [ ] **Step 1: Install the dependency**

Run: `yarn add @tanstack/react-query`
Expected: `package.json` gains `"@tanstack/react-query": "^5.x"` under dependencies; `yarn.lock` updates.

- [ ] **Step 2: Create the QueryClient singleton**

Create `src/lib/query/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

// Single shared cache for the app. staleTime keeps revisits instant (served
// from cache, revalidated in the background) instead of cold-fetching.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — hero/category data changes rarely
      gcTime: 1000 * 60 * 30, // keep unused data 30 min for fast back-nav
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 3: Wrap the app in the provider**

In `app/_layout.tsx`, add the import near the other imports (after line 12):

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/query/queryClient';
```

Then wrap the returned tree in `RootLayout` (replace the `return (<> ... </>)` block at lines 73-79):

```tsx
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <AnalyticsProvider />
      <AuthGate />
    </QueryClientProvider>
  );
```

- [ ] **Step 4: Verify it compiles**

Run: `yarn typecheck`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock src/lib/query/queryClient.ts app/_layout.tsx
git commit -m "feat(perf): add react-query client + provider"
```

---

### Task 2: Query-key factory

**Files:**
- Create: `src/lib/query/keys.ts`

- [ ] **Step 1: Create the key factory**

Create `src/lib/query/keys.ts`:

```ts
import type { CategorySlug, CategoryPublisher } from '../db/heroes';
import type { CategoryFilters } from '../db/categoryFilters';

// Single source of truth for cache keys. All keys live under the 'heroes' root
// so the whole domain can be invalidated at once, and so findCachedHero can scan
// every category list with the ['heroes','category'] prefix.
export const queryKeys = {
  root: ['heroes'] as const,
  categoryPage: (slug: CategorySlug, filters: CategoryFilters) =>
    ['heroes', 'category', slug, filters] as const,
  featured: (slug: CategorySlug, publisher: CategoryPublisher) =>
    ['heroes', 'featured', slug, publisher] as const,
  heroDetail: (id: string) => ['heroes', 'detail', id] as const,
};
```

- [ ] **Step 2: Verify it compiles**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/query/keys.ts
git commit -m "feat(perf): add query-key factory"
```

---

### Task 3: Narrow the category query + make the count conditional

The category grid renders only `id, name, image_url, portrait_url` (native cards) plus `publisher, issue_count` (native featured banner) and `image_md_url` (web cards). It currently `select('*')` — pulling every heavy text/JSON column for 30 rows — and forces `count: 'exact'` on every page including infinite-scroll appends. Narrow the columns and count only when asked.

**Files:**
- Modify: `src/lib/db/heroes.ts:378-451`
- Test: `__tests__/lib/db/heroes.categoryPage.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/db/heroes.categoryPage.test.ts`, inside the existing `describe('getCategoryPage filter mapping', ...)` block (after the last `it`, before the closing `});` on line 110):

```ts
  it('selects a narrowed list-column set, never select(*)', async () => {
    await getCategoryPage('popular', opts());
    const cols = chain.select.mock.calls[0][0] as string;
    expect(cols).not.toBe('*');
    expect(cols).toContain('id');
    expect(cols).toContain('image_url');
    expect(cols).toContain('image_md_url'); // web card needs this
    expect(cols).not.toContain('summary'); // heavy blob must be excluded
  });
  it('requests an exact count on the first page by default', async () => {
    await getCategoryPage('popular', opts());
    expect(chain.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact' });
  });
  it('omits the count when withCount is false (append pages)', async () => {
    await getCategoryPage('popular', opts({ withCount: false }));
    expect(chain.select).toHaveBeenCalledWith(expect.any(String), undefined);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn jest __tests__/lib/db/heroes.categoryPage.test.ts -t "narrowed list-column"`
Expected: FAIL — current code calls `select('*', { count: 'exact' })`.

- [ ] **Step 3: Implement the narrowing + conditional count**

In `src/lib/db/heroes.ts`, add this constant just above `export async function getCategoryPage` (line 378):

```ts
// Columns the category grid + featured banner actually render (native and web).
// Excludes heavy text/JSON columns (summary, description, movies, enemies,
// friends, creators, first_issue_data, powers...) which the list never shows.
const CATEGORY_LIST_COLUMNS =
  'id, name, image_url, image_md_url, portrait_url, publisher, issue_count';
```

Change the `getCategoryPage` signature (line 378-382) to accept `withCount`:

```ts
export async function getCategoryPage(
  slug: CategorySlug,
  options: { page: number; pageSize?: number; withCount?: boolean } & CategoryFilters,
): Promise<{ heroes: Hero[]; total: number }> {
  const {
    page,
    pageSize = 48,
    withCount = true,
    sort,
    publisher,
    alignment,
    gender,
    hasStats,
    search,
  } = options;
  const from = page * pageSize;
  const to = from + pageSize - 1;
```

Change the query initialisation (was line 386-387):

```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('heroes')
    .select(CATEGORY_LIST_COLUMNS, withCount ? { count: 'exact' } : undefined);
```

Leave the rest of the function (filter switch, facets, sort, `.range(from, to)`, return) unchanged.

- [ ] **Step 4: Run the full file's tests**

Run: `yarn jest __tests__/lib/db/heroes.categoryPage.test.ts`
Expected: PASS — new tests pass and all pre-existing filter-mapping tests still pass (they default to `withCount: true`, so `count` is still requested and `res.total` still returns).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.categoryPage.test.ts
git commit -m "perf(category): select only list columns, count rows on first page only"
```

---

### Task 4: Pure cache helpers

`findCachedHero` lets the character screen paint instantly: it scans every cached category list for the tapped hero and hands the row to the detail query as `placeholderData`.

**Files:**
- Create: `src/lib/query/heroCache.ts`
- Test: `__tests__/lib/query/heroCache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/query/heroCache.test.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';
import { flattenCategoryPages, findCachedHero } from '../../../src/lib/query/heroCache';
import type { Hero } from '../../../src/lib/db/heroes';

const hero = (id: string, name: string) => ({ id, name } as unknown as Hero);

describe('flattenCategoryPages', () => {
  it('returns [] for undefined', () => {
    expect(flattenCategoryPages(undefined)).toEqual([]);
  });
  it('concatenates heroes across pages in order', () => {
    const data = {
      pageParams: [0, 1],
      pages: [
        { heroes: [hero('1', 'A')], total: 2 },
        { heroes: [hero('2', 'B')], total: 2 },
      ],
    };
    expect(flattenCategoryPages(data).map((h) => h.id)).toEqual(['1', '2']);
  });
});

describe('findCachedHero', () => {
  it('finds a hero seeded in any cached category list', () => {
    const client = new QueryClient();
    client.setQueryData(['heroes', 'category', 'popular', {}], {
      pageParams: [0],
      pages: [{ heroes: [hero('42', 'Batman')], total: 1 }],
    });
    expect(findCachedHero(client, '42')?.name).toBe('Batman');
  });
  it('returns undefined when the hero is not cached', () => {
    const client = new QueryClient();
    expect(findCachedHero(client, '99')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn jest __tests__/lib/query/heroCache.test.ts`
Expected: FAIL — `heroCache` module does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/query/heroCache.ts`:

```ts
import type { QueryClient } from '@tanstack/react-query';
import type { Hero } from '../db/heroes';

export interface CategoryPage {
  heroes: Hero[];
  total: number;
}
export interface InfiniteCategoryData {
  pages: CategoryPage[];
  pageParams: unknown[];
}

/** Flattens infinite-query pages into one ordered hero list. */
export function flattenCategoryPages(data: InfiniteCategoryData | undefined): Hero[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.heroes);
}

/**
 * Scans every cached category list for a hero with this id, so the detail
 * screen can paint name + portrait instantly from data already in memory.
 */
export function findCachedHero(client: QueryClient, id: string): Hero | undefined {
  const entries = client.getQueriesData<InfiniteCategoryData>({
    queryKey: ['heroes', 'category'],
  });
  for (const [, data] of entries) {
    const hit = flattenCategoryPages(data).find((h) => h.id === id);
    if (hit) return hit;
  }
  return undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn jest __tests__/lib/query/heroCache.test.ts`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/query/heroCache.ts __tests__/lib/query/heroCache.test.ts
git commit -m "feat(perf): add hero cache helpers (flatten + findCachedHero)"
```

---

### Task 5: Query hooks

**Files:**
- Create: `src/lib/query/heroQueries.ts`

- [ ] **Step 1: Implement the hooks**

Create `src/lib/query/heroQueries.ts`:

```ts
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  getCategoryPage,
  getHeroById,
  type CategorySlug,
  type CategoryPublisher,
} from '../db/heroes';
import { DEFAULT_FILTERS, type CategoryFilters } from '../db/categoryFilters';
import { queryKeys } from './keys';
import { findCachedHero } from './heroCache';

export const CATEGORY_PAGE_SIZE = 30;

/** Infinite list for the category grid. Counts only on page 0 (via withCount). */
export function useCategoryHeroes(slug: CategorySlug | null, filters: CategoryFilters) {
  return useInfiniteQuery({
    queryKey: slug ? queryKeys.categoryPage(slug, filters) : ['heroes', 'category', 'disabled'],
    enabled: !!slug,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getCategoryPage(slug!, {
        page: pageParam,
        pageSize: CATEGORY_PAGE_SIZE,
        withCount: pageParam === 0,
        ...filters,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.heroes.length === CATEGORY_PAGE_SIZE ? allPages.length : undefined,
  });
}

/** Single most-popular hero for the featured banner (respects publisher facet). */
export function useFeaturedHero(slug: CategorySlug | null, publisher: CategoryPublisher) {
  return useQuery({
    queryKey: slug ? queryKeys.featured(slug, publisher) : ['heroes', 'featured', 'disabled'],
    enabled: !!slug,
    queryFn: async () => {
      const res = await getCategoryPage(slug!, {
        ...DEFAULT_FILTERS,
        page: 0,
        pageSize: 1,
        withCount: false,
        sort: 'popular',
        publisher,
      });
      return res.heroes[0] ?? null;
    },
  });
}

/** The hero row for the detail screen. Placeholder = the row already cached in
 *  a category list, so name + portrait paint instantly on navigation. */
export function useHeroRow(id: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: id ? queryKeys.heroDetail(id) : ['heroes', 'detail', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroById(id!),
    placeholderData: () => (id ? findCachedHero(client, id) : undefined),
  });
}

/** Warm the detail row before navigating (call on card press). */
export function prefetchHeroRow(client: QueryClient, id: string) {
  return client.prefetchQuery({
    queryKey: queryKeys.heroDetail(id),
    queryFn: () => getHeroById(id),
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/query/heroQueries.ts
git commit -m "feat(perf): add hero query hooks (category, featured, detail, prefetch)"
```

---

### Task 6: Convert the native category screen to the hooks

Replace the manual `useState`/`useRef`/`useEffect` fetch machinery in `app/category/[slug].tsx` with the query hooks. Keep all JSX and styles. Search is debounced into a separate `debouncedSearch` value so the query key doesn't change on every keystroke. Prefetch the detail row on card press.

**Files:**
- Modify: `app/category/[slug].tsx`

- [ ] **Step 1: Update imports**

In `app/category/[slug].tsx`, replace the `getCategoryPage` import (line 22) — remove `getCategoryPage` from the `../../src/lib/db/heroes` import list (keep `CATEGORY_LABELS`, types, etc.), and add below the existing imports:

```tsx
import { useQueryClient } from '@tanstack/react-query';
import {
  useCategoryHeroes,
  useFeaturedHero,
  prefetchHeroRow,
} from '../../src/lib/query/heroQueries';
import { flattenCategoryPages } from '../../src/lib/query/heroCache';
import { DEFAULT_FILTERS } from '../../src/lib/db/categoryFilters';
```

(`DEFAULT_FILTERS` is already imported on line 29 — keep that single import, do not duplicate.)

- [ ] **Step 2: Replace the data-layer block inside `CategoryScreen`**

Delete the state/refs/effects that drive fetching: `heroes`, `total`, `loading`, `loadingMore`, `featuredHero`, the `currentPage`/`searchTimer`/`hasMore` refs, and the `fetchPage`, `fetchFeatured`, initial-load `useEffect`, `handleSortChange`, `handlePublisherChange`, `handleSearchChange`, `handleEndReached` (lines ~200-307). Keep `sort`, `publisher`, `search`, `filterOpen`, `navigating`, `searchFocused` state. Replace with:

```tsx
  const queryClient = useQueryClient();

  // Debounce the search box into the query key so we don't refetch per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters: CategoryFilters = useMemo(
    () => ({ ...DEFAULT_FILTERS, sort, publisher, search: debouncedSearch }),
    [sort, publisher, debouncedSearch],
  );

  const categoryQuery = useCategoryHeroes(categorySlug, filters);
  const featuredQuery = useFeaturedHero(categorySlug, publisher);

  const heroes = flattenCategoryPages(categoryQuery.data);
  const total = categoryQuery.data?.pages[0]?.total ?? 0;
  const loading = categoryQuery.isPending;
  const loadingMore = categoryQuery.isFetchingNextPage;
  const featuredHero = featuredQuery.data ?? null;

  const handleSortChange = useCallback((s: SortOption) => setSort(s), []);
  const handlePublisherChange = useCallback((p: CategoryPublisher) => setPublisher(p), []);
  const handleSearchChange = useCallback((text: string) => setSearch(text), []);
  const handleEndReached = useCallback(() => {
    if (categoryQuery.hasNextPage && !categoryQuery.isFetchingNextPage) {
      categoryQuery.fetchNextPage();
    }
  }, [categoryQuery]);
```

Add `CategoryFilters` to the `categoryFilters` import on line 29:

```tsx
import { DEFAULT_FILTERS, type CategoryFilters } from '../../src/lib/db/categoryFilters';
```

- [ ] **Step 3: Prefetch on press in `handleHeroPress`**

Replace the body of `handleHeroPress` (lines 309-318) with:

```tsx
  const handleHeroPress = useCallback(
    (id: string) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      prefetchHeroRow(queryClient, id);
      setNavigating(true);
      router.push(`/character/${id}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating, queryClient],
  );
```

- [ ] **Step 4: Verify the type checks and the screen builds**

Run: `yarn typecheck`
Expected: PASS. (If `setHeroes`/`setTotal`/etc. references remain, the compiler will flag them — remove any leftover references to the deleted state.)

- [ ] **Step 5: Manual verification**

Run the app (`yarn start`, open the native client). Open a category from Discover. Confirm: skeleton appears, grid fills, scrolling to the bottom loads more, the Popular/A–Z toggle and publisher filter refilter, typing in search refilters after a brief pause, the featured banner shows. Go back and reopen the same category — it should appear **instantly** from cache.

- [ ] **Step 6: Commit**

```bash
git add app/category/[slug].tsx
git commit -m "perf(category): drive grid + featured from react-query, prefetch on press"
```

---

### Task 7: Source the character screen's hero row from the cache-backed query

Replace the `getHeroById(id).then(...)` call inside the character screen's load effect with `useHeroRow(id)`. The placeholder row (from the category list cache) paints name + portrait immediately; the enrichment branching runs only once the **real** row arrives (`!isPlaceholderData`), preserving the existing ComicVine / API-fallback logic.

**Files:**
- Modify: `app/character/[id].tsx:10-11, 240-397, 435-444`

- [ ] **Step 1: Update imports**

In `app/character/[id].tsx`, keep the existing `getHeroById, heroRowToCharacterData` import (line 11) — `heroRowToCharacterData` is still used. Add:

```tsx
import { useHeroRow } from '../../src/lib/query/heroQueries';
```

- [ ] **Step 2: Add the row query and feed the load effect from it**

After the existing state declarations (after line 246, `const [favCount, setFavCount] = useState<number>(0);`) add:

```tsx
  const heroRowQuery = useHeroRow(id);
  const heroRow = heroRowQuery.data;
```

Replace the load `useEffect` (lines 306-397) so it no longer calls `getHeroById` itself but reacts to `heroRowQuery`:

```tsx
  useEffect(() => {
    if (!id) return;

    const loadFromApi = () => {
      fetchHeroStats(id)
        .then((stats) => {
          setData({
            stats,
            details: {
              summary: null,
              publisher: null,
              firstIssueId: null,
              firstIssueData: null,
              powers: null,
              description: null,
              origin: null,
              issueCount: null,
              creators: null,
              enemies: null,
              friends: null,
              movies: null,
              movieCount: null,
              teams: null,
            },
            firstIssue: null,
          });
          fetchHeroDetails(stats.id, stats.name)
            .then((details) => {
              setData({ stats, details, firstIssue: details.firstIssueData });
            })
            .catch(() => {})
            .finally(() => setComicVineLoading(false));
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Failed to load character');
        });
    };

    // Wait for the real row (ignore the instant placeholder used only for paint).
    if (heroRowQuery.isPlaceholderData) return;

    // Query settled with no row → hero not enriched, fall back to external APIs.
    if (heroRowQuery.isError || (heroRowQuery.isSuccess && !heroRow)) {
      loadFromApi();
      return;
    }
    if (!heroRow) return;

    if (heroRow.enriched_at) {
      setData(heroRowToCharacterData(heroRow));
      const needsComicVine =
        !heroRow.comicvine_enriched_at ||
        heroRow.powers === null ||
        !heroRow.movies?.length ||
        !heroRow.first_issue_id ||
        !heroRow.first_issue_data;
      const moviesIncomplete =
        !needsComicVine &&
        heroRow.movie_count != null &&
        heroRow.movies != null &&
        heroRow.movie_count > (heroRow.movies as unknown[]).length;
      const moviesLackDetail =
        !needsComicVine &&
        !moviesIncomplete &&
        heroRow.movies != null &&
        (heroRow.movies as unknown[]).length > 0 &&
        (
          heroRow.movies as Array<{
            deck?: string | null;
            rating?: string | null;
            runtime?: string | null;
          }>
        )
          .slice(0, 5)
          .every((m) => m.deck === null && m.rating === null && m.runtime === null);
      setComicVineLoading(needsComicVine);

      if (needsComicVine || moviesIncomplete || moviesLackDetail) {
        fetchHeroDetails(heroRow.id, heroRow.name)
          .then((details) => {
            setData((prev) =>
              prev
                ? { ...prev, details, firstIssue: details.firstIssueData ?? prev.firstIssue }
                : prev,
            );
          })
          .catch(() => {})
          .finally(() => {
            if (needsComicVine) setComicVineLoading(false);
          });
      }
      return;
    }

    // Row exists but isn't enriched — use external APIs.
    loadFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, heroRow, heroRowQuery.isPlaceholderData, heroRowQuery.isError, heroRowQuery.isSuccess]);
```

- [ ] **Step 3: Use the placeholder row for instant name + image**

Replace the `heroImage` block (lines 435-441) so the cached row's portrait/image are fallbacks before `data` arrives:

```tsx
  const heroImage = id
    ? heroImageSource(
        id,
        data?.stats.image.url ?? heroRow?.image_url ?? null,
        data?.stats.image.portraitUrl ?? heroRow?.portrait_url ?? paramImageUri ?? null,
      )
    : null;
```

And extend `displayName` (line 444) to fall back to the cached row's name:

```tsx
  const displayName = data?.stats.name ?? heroRow?.name ?? paramName ?? '';
```

- [ ] **Step 4: Verify the type checks**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Run the app. From a category grid, tap a hero. Confirm the **name and portrait appear immediately** (no blank header) while the stats/sections show skeletons, then fill in. Tap an unenriched hero (e.g. a deep search result) and confirm the external-API fallback still populates it. Go back and reopen the same hero — instant from cache.

- [ ] **Step 6: Commit**

```bash
git add app/character/[id].tsx
git commit -m "perf(character): source hero row from cached query, instant placeholder paint"
```

---

### Task 8: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `yarn test:ci`
Expected: PASS — all suites green (pre-existing `act()` warnings in `useAuth.test.ts` are cosmetic per CLAUDE.md).

- [ ] **Step 2: Typecheck + format check**

Run: `yarn typecheck && yarn format:check`
Expected: both PASS. If `format:check` fails, run `yarn format` and amend.

- [ ] **Step 3: Final manual smoke**

Open Discover → a category → a hero → back → same category (cached) → same hero (cached). Confirm each transition feels instant after first load, and infinite scroll + filters still work.

- [ ] **Step 4: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: format + regression pass for react-query perf work"
```

---

## Self-Review Notes

- **Spec coverage:** Layer 1 (React Query) = Tasks 1,2,4,5,6,7. Layer 2 (query shaping) = Task 3. Layer 3 (DB indexing + bg enrichment) = explicitly deferred to a follow-up plan, noted in the header.
- **Type consistency:** `withCount` (Task 3) ↔ used in `useCategoryHeroes`/`useFeaturedHero` (Task 5). `flattenCategoryPages`/`findCachedHero` (Task 4) ↔ consumed in Tasks 5,6,7. `useHeroRow`/`prefetchHeroRow` (Task 5) ↔ used in Tasks 6,7. `CATEGORY_PAGE_SIZE` defined once in Task 5.
- **Web safety:** `CATEGORY_LIST_COLUMNS` includes `image_md_url` (web card) and `publisher`/`issue_count` (native banner); both `.web.tsx` and native category screens render only fields in this set.
- **Risk note:** Task 7 is the most intricate — it preserves the exact ComicVine/fallback branching, only changing where the row comes from. The `isPlaceholderData` guard is what prevents the placeholder row (which has `enriched_at == null`) from wrongly triggering the API fallback.
```

