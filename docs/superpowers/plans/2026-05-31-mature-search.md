# Mature Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken 600-hero alphabetical pre-load with a two-mode search — iconic heroes in idle, live full-DB server search when typing — so every character in the 3,000+ DB is findable.

**Architecture:** `SearchSheet` tracks two distinct states: _idle_ (no query) shows the top 30 most iconic heroes pre-fetched once on mount via a new `getSearchIdleHeroes()` function; _active_ (query typed) fires a debounced (300ms) server-side `searchHeroes()` call and applies `rankResults()` for relevance ordering. Results are never blanked mid-flight — previous results stay visible while a new search loads. A small `ActivityIndicator` in the search bar signals in-flight state.

**Tech Stack:** React Native, Supabase PostgREST (`@supabase/supabase-js`), expo-router, existing `searchHeroes` / `rankResults` / `getIconicHeroes` in `src/lib/db/heroes.ts`.

---

## File Map

| File                              | Action | Purpose                                                     |
| --------------------------------- | ------ | ----------------------------------------------------------- |
| `src/lib/db/heroes.ts`            | Modify | Add `getSearchIdleHeroes()`, fix `searchHeroes` ordering    |
| `src/components/SearchSheet.tsx`  | Modify | Two-mode state machine, live search, spinner, section label |
| `__tests__/lib/db/heroes.test.ts` | Modify | Tests for `getSearchIdleHeroes` and updated `searchHeroes`  |

---

## Task 1: Add `getSearchIdleHeroes` and fix `searchHeroes` ordering

**Files:**

- Modify: `src/lib/db/heroes.ts`
- Modify: `__tests__/lib/db/heroes.test.ts`

### Step 1: Write failing tests

Add to `__tests__/lib/db/heroes.test.ts`:

```ts
describe('getSearchIdleHeroes', () => {
  it('returns up to 30 heroes', async () => {
    const heroes = await getSearchIdleHeroes();
    expect(heroes.length).toBeGreaterThan(0);
    expect(heroes.length).toBeLessThanOrEqual(30);
  });

  it('returns HeroSearchResult shape (has portrait_url, full_name, aliases)', async () => {
    const heroes = await getSearchIdleHeroes();
    if (heroes.length > 0) {
      expect(heroes[0]).toHaveProperty('id');
      expect(heroes[0]).toHaveProperty('name');
      expect(heroes[0]).toHaveProperty('portrait_url');
    }
  });
});

describe('searchHeroes ordering', () => {
  it('returns spider-man before spider-woman when searching spider', async () => {
    const results = await searchHeroes('spider', 'All', 20);
    const names = results.map((h) => h.name.toLowerCase());
    const spiderManIdx = names.findIndex((n) => n === 'spider-man');
    const spiderWomanIdx = names.findIndex((n) => n === 'spider-woman');
    if (spiderManIdx !== -1 && spiderWomanIdx !== -1) {
      expect(spiderManIdx).toBeLessThan(spiderWomanIdx);
    }
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
yarn test:ci --testPathPattern="heroes.test"
```

Expected: FAIL — `getSearchIdleHeroes` not exported yet.

- [ ] **Step 3: Add `getSearchIdleHeroes` and fix `searchHeroes` ordering in `src/lib/db/heroes.ts`**

After the existing `searchHeroes` function, add:

```ts
export async function getSearchIdleHeroes(limit = 30): Promise<HeroSearchResult[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, image_url, portrait_url, full_name, aliases')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as HeroSearchResult[];
}
```

Also update `searchHeroes` to order by `issue_count DESC` when a query is present (better than alphabetical for relevance within tiers that `rankResults` doesn't distinguish):

```ts
export async function searchHeroes(
  query: string,
  publisher: PublisherFilter,
  limit = 100,
): Promise<HeroSearchResult[]> {
  let q = supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, image_url, portrait_url, full_name, aliases')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (query.trim()) {
    q = q.or(`name.ilike.%${query}%,full_name.ilike.%${query}%`) as typeof q;
  }

  if (publisher === 'Marvel') {
    q = q.ilike('publisher', '%marvel%') as typeof q;
  } else if (publisher === 'DC') {
    q = q.ilike('publisher', '%dc%') as typeof q;
  } else if (publisher === 'Other') {
    q = q.not('publisher', 'ilike', '%marvel%').not('publisher', 'ilike', '%dc%') as typeof q;
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as HeroSearchResult[];
}
```

- [ ] **Step 4: Export `getSearchIdleHeroes` — add it to the import in the test file**

In `__tests__/lib/db/heroes.test.ts`, add `getSearchIdleHeroes` to the import:

```ts
import { searchHeroes, getSearchIdleHeroes, rankResults } from '../../src/lib/db/heroes';
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
yarn test:ci --testPathPattern="heroes.test"
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.test.ts
git commit -m "feat(search): add getSearchIdleHeroes, order searchHeroes by issue_count"
```

---

## Task 2: Rewrite SearchSheet state machine

**Files:**

- Modify: `src/components/SearchSheet.tsx`

This task replaces the pre-load approach with the two-mode state machine. The component UI (animations, FlatList, PortraitCard, publisher pills) is unchanged — only the data layer and loading state change.

- [ ] **Step 1: Update imports — add `ActivityIndicator` from react-native and `getSearchIdleHeroes`**

At the top of `src/components/SearchSheet.tsx`:

```ts
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
  ActivityIndicator, // ← add
} from 'react-native';
```

```ts
import { searchHeroes, rankResults, getSearchIdleHeroes } from '../lib/db/heroes'; // add getSearchIdleHeroes
```

- [ ] **Step 2: Replace state declarations**

Find the block starting at `const [allHeroes, setAllHeroes]` and replace everything through `const debouncedQuery`:

```ts
const [idleHeroes, setIdleHeroes] = useState<HeroSearchResult[]>([]);
const [idleLoading, setIdleLoading] = useState(true);
const [searchResults, setSearchResults] = useState<HeroSearchResult[] | null>(null);
const [isSearching, setIsSearching] = useState(false);
const [query, setQuery] = useState('');
const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
const cardWidth = (SCREEN_WIDTH - H_PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const debouncedQuery = useDebounce(query, 300); // 300ms for server calls
```

- [ ] **Step 3: Replace the idle load `useEffect`**

Replace the `useEffect` that called `searchHeroes('', 'All', 600)`:

```ts
useEffect(() => {
  getSearchIdleHeroes(30)
    .then(setIdleHeroes)
    .catch(() => {})
    .finally(() => setIdleLoading(false));
}, []);
```

- [ ] **Step 4: Add live search `useEffect`**

Add this after the idle load effect:

```ts
useEffect(() => {
  if (!debouncedQuery.trim()) {
    setSearchResults(null);
    setIsSearching(false);
    return;
  }

  setIsSearching(true);
  searchHeroes(debouncedQuery, publisherFilter, 100)
    .then((results) => setSearchResults(rankResults(results, debouncedQuery)))
    .catch(() => setSearchResults([]))
    .finally(() => setIsSearching(false));
}, [debouncedQuery, publisherFilter]);
```

- [ ] **Step 5: Replace `filteredHeroes` and `displayedHeroes`**

Replace the `filteredHeroes` useMemo and `displayedHeroes` line:

```ts
// In idle mode, apply publisher filter client-side on the cached iconic heroes.
// In search mode, the server already filtered by publisher — just show results.
const displayedHeroes = useMemo(() => {
  if (searchResults !== null) return searchResults.slice(0, 100);

  const filtered =
    publisherFilter === 'All'
      ? idleHeroes
      : idleHeroes.filter((h) => {
          const pub = (h.publisher ?? '').toLowerCase();
          if (publisherFilter === 'Marvel') return pub.includes('marvel');
          if (publisherFilter === 'DC') return pub.includes('dc');
          return !pub.includes('marvel') && !pub.includes('dc');
        });
  return filtered;
}, [idleHeroes, searchResults, publisherFilter]);
```

- [ ] **Step 6: Update `loadingAll` references to `idleLoading`**

In the JSX, find `loadingAll` and replace:

```tsx
          {idleLoading ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>Loading heroes…</Text>
            </View>
          ) : displayedHeroes.length === 0 && !isSearching ? (
```

- [ ] **Step 7: Add spinner in search bar and section label**

Find the search bar `<View style={styles.searchBar}>` and add the spinner just before the closing `</View>` of the bar (after the clear button):

```tsx
{
  isSearching ? (
    <ActivityIndicator size="small" color="rgba(245,235,220,0.45)" />
  ) : query.length > 0 ? (
    <TouchableOpacity
      onPress={() => setQuery('')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
    </TouchableOpacity>
  ) : null;
}
```

Note: this replaces the existing clear button block — the spinner takes its place while searching, the clear button shows when not searching but query exists.

Add a section label between the pills and the FlatList to orient the user:

```tsx
{
  !idleLoading && (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>
        {searchResults !== null
          ? `${displayedHeroes.length} result${displayedHeroes.length !== 1 ? 's' : ''}`
          : 'Popular'}
      </Text>
    </View>
  );
}
```

Place this just before the `{idleLoading ? (` block.

- [ ] **Step 8: Add the new styles**

Add to the `StyleSheet.create({})` block:

```ts
  sectionHeader: {
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
    paddingTop: 4,
  },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.4)',
  },
```

- [ ] **Step 9: Verify TypeScript compiles cleanly**

```bash
yarn typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/SearchSheet.tsx
git commit -m "feat(search): live full-DB search with iconic idle state and in-flight spinner"
```

---

## Task 3: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
yarn start
```

- [ ] **Step 2: Open search sheet — confirm Popular section shows iconic heroes**

Open the search sheet without typing. You should see ~30 heroes (Spider-Man, Batman, Iron Man, etc.) labelled "Popular". No "Loading heroes…" should flash for more than a moment.

- [ ] **Step 3: Type "spider" — confirm Spider-Man appears first**

Spider-Man should appear at the top of results. "14 results" (or similar count) should replace the "Popular" label. The spinner should briefly appear in the search bar as results load.

- [ ] **Step 4: Type "thor" — confirm Thor appears**

Thor and related heroes should appear. Previously Thor was absent from search results.

- [ ] **Step 5: Type "wonder" — confirm Wonder Woman appears**

Previously unreachable (W is outside top 600 alphabetically).

- [ ] **Step 6: Type "wolverine" — confirm Wolverine appears**

- [ ] **Step 7: Switch publisher filter to Marvel while "spider" is in the search bar**

Results should update to Marvel characters only. The filter change triggers a new server search.

- [ ] **Step 8: Clear the query — confirm return to Popular idle state**

Clearing the search bar should snap back to the iconic heroes list labelled "Popular" with no loading state.

- [ ] **Step 9: Final commit if any polish tweaks were made**

```bash
git add -p
git commit -m "fix(search): polish after manual verification"
```
