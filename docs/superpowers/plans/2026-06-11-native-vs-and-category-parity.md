# Native parity: VS page + category filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the native VS page and category-filter UI up to web parity by wiring already-existing data/query layers into the native screens.

**Architecture:** Pure presentational changes. Piece 1 adds the cross-platform `MatchupBadge` + an inline share pill to the native compare screen. Piece 2 expands the native iOS `Stack.Toolbar.Menu` to drive the full `CategoryFilters` object (alignment / gender / power-stats / power-sort), gated per-category by `visibleFacets`, with counts from `getCategoryFacetCounts`. No DB, migration, or query-layer changes.

**Tech Stack:** Expo Router 4, React Native, expo-router `Stack.Toolbar`, `@tanstack/react-query`, Supabase (read-only here).

**Testing note:** Per `CLAUDE.md`, we do **not** unit-test full-screen rendering or navigation. These are presentational changes over already-tested data/query/filter logic, so verification is manual (steps included per task). No new test files.

**Spec:** `docs/superpowers/specs/2026-06-11-native-vs-and-category-parity-design.md`

---

## File Structure

- **Modify:** `app/compare/[hero]/[opponent].tsx` — add MatchupBadge + inline share (Piece 1).
- **Modify:** `app/category/[slug].tsx` — full filter state + expanded toolbar menu + facet counts (Piece 2).

No new files. All imported helpers (`MatchupBadge`, `useRelationship`, `relationshipBadge`, `useCategoryFilters` building blocks in `categoryFilters.ts`, `getCategoryFacetCounts`) already exist and are cross-platform.

---

## Piece 1 — VS page parity

### Task 1: Add the relationship MatchupBadge to the native VS page

**Files:**
- Modify: `app/compare/[hero]/[opponent].tsx`

- [ ] **Step 1: Add imports**

In the import block (after the existing `StatBattleRow` import near line 23), add:

```tsx
import { MatchupBadge } from '../../../src/components/compare/MatchupBadge';
import { useRelationship } from '../../../src/lib/query/heroQueries';
import { relationshipBadge } from '../../../src/lib/db/heroes';
```

- [ ] **Step 2: Compute the badge**

Immediately after the existing `useCompareMatchup(...)` call (currently lines 47-50), add:

```tsx
  const { data: relationship } = useRelationship(hero, opponent);
  const badge = relationshipBadge(relationship);
```

- [ ] **Step 3: Render the badge between the clash card and the verdict**

In the JSX, the `navyTop` block currently renders `<View style={styles.clashCard}>…</View>` then `<View style={styles.verdictBlock}>`. Insert the badge between them:

```tsx
          </View>

          <MatchupBadge badge={badge} style={styles.matchupBadge} />

          <View style={styles.verdictBlock}>
            <VerdictReveal verdict={verdict} />
          </View>
```

(The `</View>` shown is the closing tag of the existing `clashCard` View — insert the `MatchupBadge` line directly before the existing `verdictBlock` View.)

- [ ] **Step 4: Add the badge style**

In the `StyleSheet.create({…})` block, add a `matchupBadge` entry (place it near `verdictBlock`):

```tsx
  matchupBadge: { marginTop: 14, marginBottom: 2 },
```

- [ ] **Step 5: Type-check**

Run: `yarn tsc --noEmit`
Expected: PASS (no new errors). If `yarn tsc` is not a script, run `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add "app/compare/[hero]/[opponent].tsx"
git commit -m "feat(compare): show relationship MatchupBadge on native VS page"
```

---

### Task 2: Add an inline "Share result" pill to the verdict block

**Files:**
- Modify: `app/compare/[hero]/[opponent].tsx`

The native screen already has `handleShare` (uses RN `Share.share`) wired to the header button. This adds a second, inline affordance in the verdict block to match web mobile, where the result is the moment users want to forward.

- [ ] **Step 1: Add the inline pill inside the verdict block**

Replace the existing verdict block:

```tsx
          <View style={styles.verdictBlock}>
            <VerdictReveal verdict={verdict} />
          </View>
```

with:

```tsx
          <View style={styles.verdictBlock}>
            <VerdictReveal verdict={verdict} />
            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share matchup"
              style={styles.shareRow}
            >
              <Ionicons name="share-outline" size={14} color="rgba(245,235,220,0.7)" />
              <Text style={styles.shareRowText}>Share result</Text>
            </TouchableOpacity>
          </View>
```

(`TouchableOpacity`, `Text`, and `Ionicons` are already imported in this file.)

- [ ] **Step 2: Add the pill styles**

In `StyleSheet.create`, add (near `verdictBlock`):

```tsx
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.18)',
  },
  shareRowText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.7)',
  },
```

- [ ] **Step 3: Type-check**

Run: `yarn tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 4: Commit**

```bash
git add "app/compare/[hero]/[opponent].tsx"
git commit -m "feat(compare): add inline share affordance to native verdict block"
```

- [ ] **Step 5: Manual verification (Piece 1)**

Run the app (`yarn start`, open iOS). Navigate to a known rivalry matchup (e.g. via a hero's Compare → pick a rival) and confirm: a tone-coloured relationship pill (e.g. "Classic Rivalry") appears above the verdict, and a "Share result" pill sits below the verdict and opens the native share sheet. Then open a non-rival matchup and confirm **no** badge renders (the verdict + share pill still show).

---

## Piece 2 — Category filters parity

### Task 3: Replace local sort/publisher state with full CategoryFilters

**Files:**
- Modify: `app/category/[slug].tsx`

This swaps the two narrow `useState`s for the full filter shape so alignment / gender / hasStats / power-sort flow into the existing `useCategoryHeroes` query. Behaviour is unchanged until Task 4 surfaces the new facets.

- [ ] **Step 1: Update imports**

The file currently imports `SortOption` and `CategoryPublisher` from `heroes` and `DEFAULT_FILTERS, type CategoryFilters` from `categoryFilters`. Replace the `categoryFilters` import line with one that also pulls the helpers used below:

```tsx
import {
  DEFAULT_FILTERS,
  defaultSort,
  visibleFacets,
  activeFilterList,
  type CategoryFilters,
} from '../../src/lib/db/categoryFilters';
```

Add the facet-counts data import alongside the existing `heroes` imports:

```tsx
import { getCategoryFacetCounts } from '../../src/lib/db/heroes';
import type { FacetCounts } from '../../src/lib/db/categoryFilters';
```

(Leave the existing `SortOption` / `CategoryPublisher` type imports in place; they are no longer referenced after this task — remove them only if `tsc`/lint flags them as unused.)

- [ ] **Step 2: Replace the state declarations**

Replace:

```tsx
  const [sort, setSort] = useState<SortOption>('popular');
  const [publisher, setPublisher] = useState<CategoryPublisher>('all');
  const [search, setSearch] = useState('');
```

with:

```tsx
  const [filters, setFilters] = useState<CategoryFilters>(() => ({
    ...DEFAULT_FILTERS,
    sort: categorySlug ? defaultSort(categorySlug) : 'popular',
  }));
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<FacetCounts | null>(null);

  const setFilter = useCallback(
    <K extends keyof CategoryFilters>(key: K, value: CategoryFilters[K]) => {
      setFilters((prev) => {
        let next: CategoryFilters = { ...prev, [key]: value };
        // Power sort is meaningless without rated stats — couple them, matching web.
        if (key === 'sort' && value === 'power') next = { ...next, hasStats: true };
        return next;
      });
    },
    [],
  );
```

- [ ] **Step 3: Fold search into the filters memo**

Replace the existing `filters` memo:

```tsx
  const filters: CategoryFilters = useMemo(
    () => ({ ...DEFAULT_FILTERS, sort, publisher, search: debouncedSearch }),
    [sort, publisher, debouncedSearch],
  );
```

with a memo that merges the debounced search into the filter state (rename to avoid colliding with the `filters` state variable):

```tsx
  const queryFilters: CategoryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
```

- [ ] **Step 4: Point the query at queryFilters**

Replace:

```tsx
  const categoryQuery = useCategoryHeroes(categorySlug, filters);
```

with:

```tsx
  const categoryQuery = useCategoryHeroes(categorySlug, queryFilters);
```

- [ ] **Step 5: Fetch facet counts when filters change**

After the `categoryQuery` line, add an effect (mirrors web's pattern):

```tsx
  useEffect(() => {
    if (!categorySlug) return;
    let cancelled = false;
    getCategoryFacetCounts(categorySlug, queryFilters)
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [categorySlug, queryFilters]);
```

- [ ] **Step 6: Update the eyebrow to read from filters**

The `eyebrow` IIFE references `publisher`. Replace its publisher checks with `filters.publisher`:

```tsx
  const eyebrow = (() => {
    if (search.trim()) return `${total} RESULT${total !== 1 ? 'S' : ''}`;
    const base = `${total.toLocaleString()} ${total === 1 ? 'CHARACTER' : 'CHARACTERS'}`;
    if (filters.publisher === 'marvel') return `${base} · MARVEL`;
    if (filters.publisher === 'dc') return `${base} · DC`;
    return base;
  })();
```

- [ ] **Step 7: Update the toolbar menu to use filters/setFilter (temporary, minimal)**

The existing `Stack.Toolbar.Menu` references `sort`, `setSort`, `publisher`, `setPublisher`. Update those references so the file compiles; the full menu is built in Task 4. For now replace the menu's existing actions to use the new API — Sort actions become `isOn={filters.sort === 'popular'} onPress={() => setFilter('sort', 'popular')}` (and `'az'`), and Publisher actions become `isOn={filters.publisher === 'all'} onPress={() => setFilter('publisher', 'all')}` (and `'marvel'`, `'dc'`). The menu icon condition `publisher !== 'all'` becomes `filters.publisher !== 'all'`.

- [ ] **Step 8: Type-check**

Run: `yarn tsc --noEmit`
Expected: PASS. (If `SortOption` / `CategoryPublisher` imports are now unused, remove them.)

- [ ] **Step 9: Commit**

```bash
git add "app/category/[slug].tsx"
git commit -m "refactor(category): drive native screen from full CategoryFilters + facet counts"
```

---

### Task 4: Expand the native toolbar menu with all facets, gating, counts, and reset

**Files:**
- Modify: `app/category/[slug].tsx`

- [ ] **Step 1: Add a count-label helper above the component's return**

Inside the component (after `setFilter` and before the `return`), add a helper that appends a formatted count to a label when available:

```tsx
  const visible = categorySlug ? visibleFacets(categorySlug) : [];
  const anyActive =
    (categorySlug ? activeFilterList(categorySlug, filters).length : 0) > 0 ||
    (categorySlug && filters.sort !== defaultSort(categorySlug));

  const lbl = (text: string, count?: number) =>
    typeof count === 'number' && count > 0 ? `${text} (${count.toLocaleString()})` : text;

  const resetFilters = useCallback(() => {
    setFilters({
      ...DEFAULT_FILTERS,
      sort: categorySlug ? defaultSort(categorySlug) : 'popular',
    });
  }, [categorySlug]);
```

- [ ] **Step 2: Replace the entire `Stack.Toolbar` block**

Replace the existing `<Stack.Toolbar placement="right">…</Stack.Toolbar>` with the full menu. Facet submenus are gated by `visible.includes(...)`:

```tsx
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={anyActive ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease'}
        >
          <Stack.Toolbar.Menu inline title="Sort">
            <Stack.Toolbar.MenuAction
              isOn={filters.sort === 'popular'}
              onPress={() => setFilter('sort', 'popular')}
            >
              Popular
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={filters.sort === 'az'}
              onPress={() => setFilter('sort', 'az')}
            >
              A–Z
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={filters.sort === 'power'}
              onPress={() => setFilter('sort', 'power')}
            >
              Power
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>

          {visible.includes('publisher') && (
            <Stack.Toolbar.Menu inline title="Publisher">
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'all'}
                onPress={() => setFilter('publisher', 'all')}
              >
                {lbl('All publishers', counts?.publisher.all)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'marvel'}
                onPress={() => setFilter('publisher', 'marvel')}
              >
                {lbl('Marvel', counts?.publisher.marvel)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'dc'}
                onPress={() => setFilter('publisher', 'dc')}
              >
                {lbl('DC', counts?.publisher.dc)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'other'}
                onPress={() => setFilter('publisher', 'other')}
              >
                {lbl('Other', counts?.publisher.other)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {visible.includes('alignment') && (
            <Stack.Toolbar.Menu inline title="Alignment">
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'any'}
                onPress={() => setFilter('alignment', 'any')}
              >
                Any
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'good'}
                onPress={() => setFilter('alignment', 'good')}
              >
                {lbl('Good', counts?.alignment.good)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'bad'}
                onPress={() => setFilter('alignment', 'bad')}
              >
                {lbl('Bad', counts?.alignment.bad)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'neutral'}
                onPress={() => setFilter('alignment', 'neutral')}
              >
                {lbl('Neutral', counts?.alignment.neutral)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {visible.includes('gender') && (
            <Stack.Toolbar.Menu inline title="Gender">
              <Stack.Toolbar.MenuAction
                isOn={filters.gender === 'any'}
                onPress={() => setFilter('gender', 'any')}
              >
                Any
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.gender === 'male'}
                onPress={() => setFilter('gender', 'male')}
              >
                {lbl('Male', counts?.gender.male)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.gender === 'female'}
                onPress={() => setFilter('gender', 'female')}
              >
                {lbl('Female', counts?.gender.female)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {visible.includes('hasStats') && (
            <Stack.Toolbar.Menu inline title="Power stats">
              <Stack.Toolbar.MenuAction
                isOn={!filters.hasStats}
                onPress={() => setFilter('hasStats', false)}
              >
                Any
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.hasStats}
                onPress={() => setFilter('hasStats', true)}
              >
                {lbl('Rated only', counts?.has_stats)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {anyActive && (
            <Stack.Toolbar.Menu inline>
              <Stack.Toolbar.MenuAction onPress={resetFilters}>
                Reset filters
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
```

- [ ] **Step 3: Type-check**

Run: `yarn tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `yarn lint` (if present) on the changed file, or skip if no lint script.
Expected: no new errors. Remove any now-unused imports it flags.

- [ ] **Step 5: Commit**

```bash
git add "app/category/[slug].tsx"
git commit -m "feat(category): full facet filters in native toolbar menu with counts"
```

- [ ] **Step 6: Manual verification (Piece 2)**

Run the app (iOS). For several categories confirm:
- **popular** shows Sort (Popular/A–Z/Power), Publisher, Alignment, Gender, Power stats.
- **villain** and **anti-heroes** hide Alignment.
- **marvel** / **dc** hide Publisher.
- **strongest** / **most-intelligent** hide Power stats and default Sort to Power.
- Selecting Good / Male / Rated only filters the grid and updates the eyebrow count; menu labels show counts; the toolbar icon switches to the filled variant when any filter is active; "Reset filters" appears and clears back to defaults.

---

## Self-Review

**Spec coverage:**
- VS page MatchupBadge → Task 1. ✓
- VS page inline share → Task 2. ✓
- Category full filter state → Task 3. ✓
- Alignment/gender/hasStats/power-sort + visibleFacets gating + counts + reset → Task 4. ✓
- "no DB/query changes" honoured — only screen files modified. ✓
- Eyebrow facet polish — partially addressed (publisher retained in Task 3 Step 6); deeper facet eyebrow text was marked optional in the spec and is omitted (YAGNI).

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `filters` (state) vs `queryFilters` (memo w/ search) named distinctly to avoid shadowing; `setFilter` signature `<K extends keyof CategoryFilters>(key, value)` matches usage; `counts?.has_stats` / `counts?.publisher.all` match the `FacetCounts` shape in `categoryFilters.ts`; `lbl`/`anyActive`/`visible`/`resetFilters` all defined in Task 4 Step 1 before use in Step 2. ✓
