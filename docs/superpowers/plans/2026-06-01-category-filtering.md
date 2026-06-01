# Category Page Filtering Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mature, honest filtering system (publisher, alignment, gender, has-powerstats, sort) to the web category pages, with a desktop filter rail and a mobile bottom sheet, URL-synced state, and live per-option facet counts.

**Architecture:** Pure filter logic + URL serialization live in `src/lib/db/categoryFilters.ts`; data access (`getCategoryPage`, `getCategoryFacetCounts`) in `src/lib/db/heroes.ts` backed by a new `category_facet_counts` Postgres RPC and a generated `powerstats_total` column; a platform-agnostic `useCategoryFilters` hook owns state↔URL; web UI components in `src/components/web/category/` render one shared `FilterControls` inside either a desktop rail or a mobile sheet.

**Tech Stack:** Expo Router 4, React Native Web, Supabase (PostgREST + Postgres RPC), TypeScript, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-06-01-category-filtering-design.md`

**Branch:** `feat/category-filtering` (already created, based on the iOS WebKit grid fix).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_category_facets.sql` | Generated `powerstats_total` column + `category_facet_counts` RPC |
| `src/types/database.generated.ts` | Regenerated after migration (never hand-edit) |
| `src/lib/db/categoryFilters.ts` | `CategoryFilters`/`FacetCounts` types, defaults, per-slug facet visibility + default sort, URL (de)serialization |
| `src/lib/db/heroes.ts` | Extend `getCategoryPage(slug, filters)`; add `getCategoryFacetCounts(slug, filters)` |
| `src/hooks/useCategoryFilters.ts` | Filter state ↔ URL query params; setters; active-filter list; reset |
| `src/components/web/category/FilterControls.tsx` | Shared facet UI (radio groups, toggle, sort) used by rail + sheet |
| `src/components/web/category/FilterRail.tsx` | Desktop left sidebar |
| `src/components/web/category/FilterSheet.tsx` | Mobile slide-up bottom sheet + "Apply · N" footer |
| `src/components/web/category/ActiveFilterChips.tsx` | Removable chips for non-default filters |
| `app/category/[slug].web.tsx` | Wire hook + rail/sheet/chips around the existing grid |
| `__tests__/lib/db/categoryFilters.test.ts` | Unit tests for the pure module |
| `__tests__/lib/db/heroes.categoryPage.test.ts` | Unit tests for query mapping |
| `__tests__/hooks/useCategoryFilters.test.ts` | Unit tests for the hook |

---

## Task 1: Database migration — `powerstats_total` column + facet-count RPC

**Files:**
- Create: `supabase/migrations/<timestamp>_category_facets.sql` (use a real timestamp, e.g. `20260601120000_category_facets.sql`)
- Modify (regenerate): `src/types/database.generated.ts`

> Apply via the `mcp__supabase__apply_migration` tool (name: `category_facets`), NOT by editing the dashboard. This task is verified with `mcp__supabase__execute_sql`, not Jest.

- [ ] **Step 1: Write the migration SQL**

Create the migration file with this exact content:

```sql
-- Generated total of the six powerstats. 0 when a hero has no stats, so
-- `powerstats_total > 0` is the "has powerstats" predicate. Also fixes
-- getHeroesByPowerRange(), which already references this column.
ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS powerstats_total integer
  GENERATED ALWAYS AS (
    COALESCE(intelligence, 0) + COALESCE(strength, 0) + COALESCE(speed, 0) +
    COALESCE(durability, 0) + COALESCE(power, 0) + COALESCE(combat, 0)
  ) STORED;

CREATE INDEX IF NOT EXISTS heroes_powerstats_total_idx ON heroes (powerstats_total);

-- Faceted-search counts for a category page. Each facet's option counts are
-- computed with the OTHER active filters applied but NOT the facet's own
-- selection, so a count reflects what choosing that option would actually yield.
CREATE OR REPLACE FUNCTION category_facet_counts(
  p_slug text,
  p_publisher text DEFAULT 'all',
  p_alignment text DEFAULT 'any',
  p_gender text DEFAULT 'any',
  p_has_stats boolean DEFAULT false,
  p_search text DEFAULT ''
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH base AS (
  SELECT * FROM heroes h
  WHERE
    CASE p_slug
      WHEN 'popular' THEN h.category = 'popular'
      WHEN 'villain' THEN h.alignment = 'bad' AND (h.publisher IS NULL OR h.publisher NOT IN ('Non-Fictional','In the Public Domain'))
      WHEN 'xmen' THEN (h.group_affiliation ILIKE '%x-men%' OR h.group_affiliation ILIKE '%xmen%')
      WHEN 'anti-heroes' THEN h.alignment ILIKE '%neutral%'
      WHEN 'marvel' THEN h.publisher ILIKE '%marvel%'
      WHEN 'dc' THEN h.publisher ILIKE '%dc%'
      WHEN 'strongest' THEN h.strength IS NOT NULL
      WHEN 'most-intelligent' THEN h.intelligence IS NOT NULL
      WHEN 'most-iconic' THEN (h.publisher IS NULL OR h.publisher NOT IN ('Non-Fictional','In the Public Domain','Company-Licensed'))
      ELSE true
    END
    AND (p_search = '' OR h.name ILIKE '%' || p_search || '%' OR h.full_name ILIKE '%' || p_search || '%')
),
flagged AS (
  SELECT *,
    (p_publisher = 'all'
      OR (p_publisher = 'marvel' AND publisher ILIKE '%marvel%')
      OR (p_publisher = 'dc' AND publisher ILIKE '%dc%')
      OR (p_publisher = 'other' AND publisher IS NOT NULL AND publisher NOT ILIKE '%marvel%' AND publisher NOT ILIKE '%dc%')
    ) AS pub_ok,
    (p_alignment = 'any'
      OR (p_alignment = 'good' AND alignment = 'good')
      OR (p_alignment = 'bad' AND alignment = 'bad')
      OR (p_alignment = 'neutral' AND alignment ILIKE '%neutral%')
    ) AS align_ok,
    (p_gender = 'any'
      OR (p_gender = 'male' AND gender ILIKE 'male')
      OR (p_gender = 'female' AND gender ILIKE 'female')
    ) AS gender_ok,
    (NOT p_has_stats OR powerstats_total > 0) AS stats_ok
  FROM base
)
SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM flagged WHERE pub_ok AND align_ok AND gender_ok AND stats_ok),
  'publisher', (SELECT jsonb_build_object(
      'all', count(*),
      'marvel', count(*) FILTER (WHERE publisher ILIKE '%marvel%'),
      'dc', count(*) FILTER (WHERE publisher ILIKE '%dc%'),
      'other', count(*) FILTER (WHERE publisher IS NOT NULL AND publisher NOT ILIKE '%marvel%' AND publisher NOT ILIKE '%dc%')
    ) FROM flagged WHERE align_ok AND gender_ok AND stats_ok),
  'alignment', (SELECT jsonb_build_object(
      'good', count(*) FILTER (WHERE alignment = 'good'),
      'bad', count(*) FILTER (WHERE alignment = 'bad'),
      'neutral', count(*) FILTER (WHERE alignment ILIKE '%neutral%')
    ) FROM flagged WHERE pub_ok AND gender_ok AND stats_ok),
  'gender', (SELECT jsonb_build_object(
      'male', count(*) FILTER (WHERE gender ILIKE 'male'),
      'female', count(*) FILTER (WHERE gender ILIKE 'female')
    ) FROM flagged WHERE pub_ok AND align_ok AND stats_ok),
  'has_stats', (SELECT count(*) FILTER (WHERE powerstats_total > 0) FROM flagged WHERE pub_ok AND align_ok AND gender_ok)
);
$$;

GRANT EXECUTE ON FUNCTION category_facet_counts(text, text, text, text, boolean, text) TO anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Use the `mcp__supabase__apply_migration` tool with name `category_facets` and the SQL above.

- [ ] **Step 3: Verify the column and RPC against real data**

Use `mcp__supabase__execute_sql` to run:

```sql
SELECT count(*) FILTER (WHERE powerstats_total > 0) AS with_stats FROM heroes;
SELECT category_facet_counts('villain');
SELECT category_facet_counts('popular', 'marvel', 'any', 'female', true, '');
```

Expected: `with_stats` ≈ 570. First RPC call returns a jsonb object with `total` ≈ 131 and `alignment.bad` ≈ 131. Second call returns smaller, internally-consistent counts (e.g. `gender.female` ≤ `total` of the publisher=marvel+stats slice). No SQL errors.

- [ ] **Step 4: Regenerate generated types**

Use the `mcp__supabase__generate_typescript_types` tool and write the result to `src/types/database.generated.ts` (overwrite). Confirm `powerstats_total` now appears on the `heroes` Row type and `category_facet_counts` appears under `Functions`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations src/types/database.generated.ts
git commit -m "feat(db): add powerstats_total column + category_facet_counts RPC"
```

---

## Task 2: Pure filter module — types, defaults, visibility, URL (de)serialization

**Files:**
- Create: `src/lib/db/categoryFilters.ts`
- Test: `__tests__/lib/db/categoryFilters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/db/categoryFilters.test.ts`:

```ts
import {
  DEFAULT_FILTERS,
  defaultSort,
  visibleFacets,
  filtersToParams,
  paramsToFilters,
  activeFilterList,
  type CategoryFilters,
} from '../../../src/lib/db/categoryFilters';

describe('defaultSort', () => {
  it('defaults strongest and most-intelligent to power', () => {
    expect(defaultSort('strongest')).toBe('power');
    expect(defaultSort('most-intelligent')).toBe('power');
  });
  it('defaults other slugs to popular', () => {
    expect(defaultSort('villain')).toBe('popular');
    expect(defaultSort('marvel')).toBe('popular');
  });
});

describe('visibleFacets', () => {
  it('hides alignment for villain and anti-heroes', () => {
    expect(visibleFacets('villain')).not.toContain('alignment');
    expect(visibleFacets('anti-heroes')).not.toContain('alignment');
  });
  it('hides publisher for marvel and dc', () => {
    expect(visibleFacets('marvel')).not.toContain('publisher');
    expect(visibleFacets('dc')).not.toContain('publisher');
  });
  it('hides hasStats for strongest and most-intelligent', () => {
    expect(visibleFacets('strongest')).not.toContain('hasStats');
  });
  it('shows all four for popular', () => {
    expect(visibleFacets('popular').sort()).toEqual(['alignment', 'gender', 'hasStats', 'publisher']);
  });
});

describe('filtersToParams / paramsToFilters round-trip', () => {
  it('omits defaults from params', () => {
    const params = filtersToParams('popular', DEFAULT_FILTERS);
    expect(params).toEqual({});
  });
  it('serializes non-default values', () => {
    const f: CategoryFilters = { publisher: 'marvel', alignment: 'bad', gender: 'female', hasStats: true, sort: 'az', search: 'man' };
    expect(filtersToParams('popular', f)).toEqual({
      publisher: 'marvel', alignment: 'bad', gender: 'female', stats: '1', sort: 'az', q: 'man',
    });
  });
  it('omits sort when it equals the slug default', () => {
    const f: CategoryFilters = { ...DEFAULT_FILTERS, sort: 'power' };
    expect(filtersToParams('strongest', f).sort).toBeUndefined();
  });
  it('round-trips back to the same filters', () => {
    const f: CategoryFilters = { publisher: 'dc', alignment: 'good', gender: 'male', hasStats: true, sort: 'power', search: 'bat' };
    expect(paramsToFilters('popular', filtersToParams('popular', f))).toEqual(f);
  });
  it('applies the slug default sort when no sort param present', () => {
    expect(paramsToFilters('strongest', {}).sort).toBe('power');
    expect(paramsToFilters('villain', {}).sort).toBe('popular');
  });
});

describe('activeFilterList', () => {
  it('lists only non-default, visible filters as removable chips', () => {
    const f: CategoryFilters = { ...DEFAULT_FILTERS, alignment: 'bad', gender: 'female' };
    // On villain, alignment facet is hidden, so it must not appear as a chip.
    const chips = activeFilterList('villain', f);
    expect(chips.map((c) => c.key)).toEqual(['gender']);
    expect(chips[0]).toEqual({ key: 'gender', label: 'Female' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn jest categoryFilters --no-coverage`
Expected: FAIL — `Cannot find module '../../../src/lib/db/categoryFilters'`.

- [ ] **Step 3: Implement the module**

Create `src/lib/db/categoryFilters.ts`:

```ts
import type { CategorySlug, SortOption } from './heroes';

export type PublisherOpt = 'all' | 'marvel' | 'dc' | 'other';
export type AlignmentOpt = 'any' | 'good' | 'bad' | 'neutral';
export type GenderOpt = 'any' | 'male' | 'female';
export type FacetKey = 'publisher' | 'alignment' | 'gender' | 'hasStats';

export interface CategoryFilters {
  publisher: PublisherOpt;
  alignment: AlignmentOpt;
  gender: GenderOpt;
  hasStats: boolean;
  sort: SortOption; // 'popular' | 'az' | 'power'
  search: string;
}

export interface FacetCounts {
  total: number;
  publisher: { all: number; marvel: number; dc: number; other: number };
  alignment: { good: number; bad: number; neutral: number };
  gender: { male: number; female: number };
  has_stats: number;
}

export const DEFAULT_FILTERS: CategoryFilters = {
  publisher: 'all',
  alignment: 'any',
  gender: 'any',
  hasStats: false,
  sort: 'popular',
  search: '',
};

export function defaultSort(slug: CategorySlug): SortOption {
  return slug === 'strongest' || slug === 'most-intelligent' ? 'power' : 'popular';
}

export function visibleFacets(slug: CategorySlug): FacetKey[] {
  const all: FacetKey[] = ['publisher', 'alignment', 'gender', 'hasStats'];
  return all.filter((f) => {
    if (f === 'alignment' && (slug === 'villain' || slug === 'anti-heroes')) return false;
    if (f === 'publisher' && (slug === 'marvel' || slug === 'dc')) return false;
    if (f === 'hasStats' && (slug === 'strongest' || slug === 'most-intelligent')) return false;
    return true;
  });
}

export type FilterParams = Partial<{
  publisher: string; alignment: string; gender: string; stats: string; sort: string; q: string;
}>;

export function filtersToParams(slug: CategorySlug, f: CategoryFilters): FilterParams {
  const p: FilterParams = {};
  if (f.publisher !== 'all') p.publisher = f.publisher;
  if (f.alignment !== 'any') p.alignment = f.alignment;
  if (f.gender !== 'any') p.gender = f.gender;
  if (f.hasStats) p.stats = '1';
  if (f.sort !== defaultSort(slug)) p.sort = f.sort;
  if (f.search.trim()) p.q = f.search.trim();
  return p;
}

const PUBS: PublisherOpt[] = ['all', 'marvel', 'dc', 'other'];
const ALIGNS: AlignmentOpt[] = ['any', 'good', 'bad', 'neutral'];
const GENDERS: GenderOpt[] = ['any', 'male', 'female'];
const SORTS: SortOption[] = ['popular', 'az', 'power'];

function pick<T extends string>(allowed: T[], v: string | undefined, fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function paramsToFilters(slug: CategorySlug, p: FilterParams): CategoryFilters {
  return {
    publisher: pick(PUBS, p.publisher, 'all'),
    alignment: pick(ALIGNS, p.alignment, 'any'),
    gender: pick(GENDERS, p.gender, 'any'),
    hasStats: p.stats === '1',
    sort: pick(SORTS, p.sort, defaultSort(slug)),
    search: p.q ?? '',
  };
}

const LABELS: Record<string, string> = {
  marvel: 'Marvel', dc: 'DC', other: 'Other',
  good: 'Good', bad: 'Bad', neutral: 'Neutral',
  male: 'Male', female: 'Female',
};

export interface ActiveChip { key: FacetKey | 'search'; label: string; }

export function activeFilterList(slug: CategorySlug, f: CategoryFilters): ActiveChip[] {
  const visible = visibleFacets(slug);
  const chips: ActiveChip[] = [];
  if (visible.includes('publisher') && f.publisher !== 'all') chips.push({ key: 'publisher', label: LABELS[f.publisher] });
  if (visible.includes('alignment') && f.alignment !== 'any') chips.push({ key: 'alignment', label: LABELS[f.alignment] });
  if (visible.includes('gender') && f.gender !== 'any') chips.push({ key: 'gender', label: LABELS[f.gender] });
  if (visible.includes('hasStats') && f.hasStats) chips.push({ key: 'hasStats', label: 'Has powerstats' });
  return chips;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn jest categoryFilters --no-coverage`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/categoryFilters.ts __tests__/lib/db/categoryFilters.test.ts
git commit -m "feat(category): pure filter model + URL serialization"
```

---

## Task 3: Data layer — extend `getCategoryPage`, add `getCategoryFacetCounts`

**Files:**
- Modify: `src/lib/db/heroes.ts` (`getCategoryPage` ~line 373; add `getCategoryFacetCounts` after it)
- Test: `__tests__/lib/db/heroes.categoryPage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/db/heroes.categoryPage.test.ts`. This extends the existing supabase mock pattern with `range` (awaitable, returns `{ data, error, count }`) and `rpc`:

```ts
import { getCategoryPage, getCategoryFacetCounts } from '../../../src/lib/db/heroes';
import { DEFAULT_FILTERS } from '../../../src/lib/db/categoryFilters';

let mockResolveWith: { data: unknown; error: unknown; count?: number } = { data: [], error: null, count: 0 };
let mockRpcResolveWith: { data: unknown; error: unknown } = { data: {}, error: null };

jest.mock('../../../src/lib/supabase', () => {
  const methods = ['select', 'eq', 'gte', 'lte', 'neq', 'or', 'ilike', 'not', 'order', 'limit', 'range'];
  const chain: Record<string, unknown> = {};
  methods.forEach((m) => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mockResolveWith).then(resolve);
  const mockFrom = jest.fn().mockReturnValue(chain);
  const mockRpc = jest.fn(() => Promise.resolve(mockRpcResolveWith));
  return { supabase: { from: mockFrom, rpc: mockRpc }, __chain: chain, __mockFrom: mockFrom, __mockRpc: mockRpc };
});

const { __chain: chain, __mockRpc: mockRpc } = jest.requireMock('../../../src/lib/supabase') as {
  __chain: Record<string, jest.Mock>; __mockRpc: jest.Mock;
};
const methods = ['select', 'eq', 'gte', 'lte', 'neq', 'or', 'ilike', 'not', 'order', 'limit', 'range'];

beforeEach(() => {
  jest.clearAllMocks();
  methods.forEach((m) => chain[m].mockReturnValue(chain));
  mockResolveWith = { data: [], error: null, count: 0 };
  mockRpcResolveWith = { data: {}, error: null };
});

describe('getCategoryPage filter mapping', () => {
  const opts = (over = {}) => ({ page: 0, pageSize: 48, ...DEFAULT_FILTERS, ...over });

  it('applies the marvel publisher filter', async () => {
    await getCategoryPage('popular', opts({ publisher: 'marvel' }));
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%marvel%');
  });
  it('applies the "other" publisher filter (not marvel and not dc)', async () => {
    await getCategoryPage('popular', opts({ publisher: 'other' }));
    expect(chain.not).toHaveBeenCalledWith('publisher', 'ilike', '%marvel%');
    expect(chain.not).toHaveBeenCalledWith('publisher', 'ilike', '%dc%');
  });
  it('applies alignment=bad', async () => {
    await getCategoryPage('popular', opts({ alignment: 'bad' }));
    expect(chain.eq).toHaveBeenCalledWith('alignment', 'bad');
  });
  it('applies gender=female case-insensitively', async () => {
    await getCategoryPage('popular', opts({ gender: 'female' }));
    expect(chain.ilike).toHaveBeenCalledWith('gender', 'female');
  });
  it('applies hasStats as powerstats_total > 0', async () => {
    await getCategoryPage('popular', opts({ hasStats: true }));
    expect(chain.gte).toHaveBeenCalledWith('powerstats_total', 1);
  });
  it('orders by powerstats_total for the power sort', async () => {
    await getCategoryPage('popular', opts({ sort: 'power' }));
    expect(chain.order).toHaveBeenCalledWith('powerstats_total', { ascending: false, nullsFirst: false });
  });
  it('orders by name for the az sort', async () => {
    await getCategoryPage('popular', opts({ sort: 'az' }));
    expect(chain.order).toHaveBeenCalledWith('name');
  });
  it('returns heroes and total from the response', async () => {
    mockResolveWith = { data: [{ id: '1' }], error: null, count: 7 };
    const res = await getCategoryPage('popular', opts());
    expect(res.total).toBe(7);
    expect(res.heroes).toHaveLength(1);
  });
  it('throws on supabase error', async () => {
    mockResolveWith = { data: null, error: { message: 'boom' }, count: 0 };
    await expect(getCategoryPage('popular', opts())).rejects.toThrow('boom');
  });
});

describe('getCategoryFacetCounts', () => {
  it('calls the RPC with mapped params and returns its data', async () => {
    mockRpcResolveWith = { data: { total: 3, publisher: { all: 3, marvel: 1, dc: 1, other: 1 }, alignment: { good: 0, bad: 3, neutral: 0 }, gender: { male: 2, female: 1 }, has_stats: 2 }, error: null };
    const res = await getCategoryFacetCounts('villain', { ...DEFAULT_FILTERS, gender: 'female', hasStats: true, search: 'x' });
    expect(mockRpc).toHaveBeenCalledWith('category_facet_counts', {
      p_slug: 'villain', p_publisher: 'all', p_alignment: 'any', p_gender: 'female', p_has_stats: true, p_search: 'x',
    });
    expect(res.total).toBe(3);
  });
  it('throws on RPC error', async () => {
    mockRpcResolveWith = { data: null, error: { message: 'rpc fail' } };
    await expect(getCategoryFacetCounts('villain', DEFAULT_FILTERS)).rejects.toThrow('rpc fail');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn jest heroes.categoryPage --no-coverage`
Expected: FAIL — `getCategoryFacetCounts` is not exported and the new filter params aren't applied.

- [ ] **Step 3: Update `getCategoryPage` and add `getCategoryFacetCounts`**

In `src/lib/db/heroes.ts`, replace the `getCategoryPage` options type and body. Change the signature to accept the full filter object (keep `page`/`pageSize` alongside it):

```ts
import type { CategoryFilters, FacetCounts } from './categoryFilters';

export async function getCategoryPage(
  slug: CategorySlug,
  options: { page: number; pageSize?: number } & CategoryFilters,
): Promise<{ heroes: Hero[]; total: number }> {
  const { page, pageSize = 48, sort, publisher, alignment, gender, hasStats, search } = options;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('heroes').select('*', { count: 'exact' });

  switch (slug) {
    case 'popular': q = q.eq('category', 'popular'); break;
    case 'villain':
      q = q.eq('alignment', 'bad').not('publisher', 'in', '("Non-Fictional","In the Public Domain")');
      break;
    case 'xmen': q = q.or('group_affiliation.ilike.%x-men%,group_affiliation.ilike.%xmen%'); break;
    case 'anti-heroes': q = q.ilike('alignment', '%neutral%'); break;
    case 'marvel': q = q.ilike('publisher', '%marvel%'); break;
    case 'dc': q = q.ilike('publisher', '%dc%'); break;
    case 'strongest': q = q.not('strength', 'is', null); break;
    case 'most-intelligent': q = q.not('intelligence', 'is', null); break;
    case 'most-iconic':
      q = q.not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")');
      break;
  }

  // Publisher facet
  if (publisher === 'marvel') q = q.ilike('publisher', '%marvel%');
  else if (publisher === 'dc') q = q.ilike('publisher', '%dc%');
  else if (publisher === 'other') q = q.not('publisher', 'ilike', '%marvel%').not('publisher', 'ilike', '%dc%');

  // Alignment facet
  if (alignment === 'good') q = q.eq('alignment', 'good');
  else if (alignment === 'bad') q = q.eq('alignment', 'bad');
  else if (alignment === 'neutral') q = q.ilike('alignment', '%neutral%');

  // Gender facet
  if (gender === 'male') q = q.ilike('gender', 'male');
  else if (gender === 'female') q = q.ilike('gender', 'female');

  // Has-powerstats facet
  if (hasStats) q = q.gte('powerstats_total', 1);

  // Search
  if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,full_name.ilike.%${search.trim()}%`);

  // Sort
  if (sort === 'az') q = q.order('name');
  else if (sort === 'power') q = q.order('powerstats_total', { ascending: false, nullsFirst: false });
  else q = q.order('issue_count', { ascending: false, nullsFirst: false });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  return { heroes: (data ?? []) as Hero[], total: count ?? 0 };
}

export async function getCategoryFacetCounts(
  slug: CategorySlug,
  f: CategoryFilters,
): Promise<FacetCounts> {
  const { data, error } = await supabase.rpc('category_facet_counts', {
    p_slug: slug,
    p_publisher: f.publisher,
    p_alignment: f.alignment,
    p_gender: f.gender,
    p_has_stats: f.hasStats,
    p_search: f.search.trim(),
  });
  if (error) throw new Error(error.message);
  return data as unknown as FacetCounts;
}
```

Note: `SortOption` stays `'popular' | 'az' | 'power'` — update its definition near line 261 to add `'power'`:

```ts
export type SortOption = 'popular' | 'az' | 'power';
```

Remove the now-unused `CategoryPublisher` type and its usages **only if** nothing else imports it; otherwise leave it. (Check with `grep -rn "CategoryPublisher" src app`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn jest heroes.categoryPage --no-coverage`
Expected: PASS.

- [ ] **Step 5: Run the full db test file to check for regressions**

Run: `yarn jest "lib/db/heroes" --no-coverage`
Expected: PASS (existing `heroes.test.ts` still green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.categoryPage.test.ts
git commit -m "feat(category): full filter query mapping + facet-count fetch"
```

---

## Task 4: `useCategoryFilters` hook — state ↔ URL

**Files:**
- Create: `src/hooks/useCategoryFilters.ts`
- Test: `__tests__/hooks/useCategoryFilters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/hooks/useCategoryFilters.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react-native';
import { useCategoryFilters } from '../../src/hooks/useCategoryFilters';
import { DEFAULT_FILTERS } from '../../src/lib/db/categoryFilters';

let mockParams: Record<string, string> = {};
const mockSetParams = jest.fn((p: Record<string, string>) => { mockParams = { ...mockParams, ...p }; });

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

beforeEach(() => { mockParams = {}; mockSetParams.mockClear(); });

describe('useCategoryFilters', () => {
  it('starts from DEFAULT_FILTERS for a plain slug', () => {
    const { result } = renderHook(() => useCategoryFilters('popular'));
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('uses the slug default sort (power) for strongest', () => {
    const { result } = renderHook(() => useCategoryFilters('strongest'));
    expect(result.current.filters.sort).toBe('power');
  });

  it('setFilter updates state and pushes to the URL', () => {
    const { result } = renderHook(() => useCategoryFilters('popular'));
    act(() => result.current.setFilter('gender', 'female'));
    expect(result.current.filters.gender).toBe('female');
    expect(mockSetParams).toHaveBeenCalledWith(expect.objectContaining({ gender: 'female' }));
  });

  it('selecting the power sort auto-enables hasStats', () => {
    const { result } = renderHook(() => useCategoryFilters('popular'));
    act(() => result.current.setFilter('sort', 'power'));
    expect(result.current.filters.hasStats).toBe(true);
  });

  it('reset returns to defaults and clears params', () => {
    mockParams = { gender: 'female', alignment: 'bad' };
    const { result } = renderHook(() => useCategoryFilters('popular'));
    act(() => result.current.reset());
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    expect(mockSetParams).toHaveBeenCalledWith({ publisher: '', alignment: '', gender: '', stats: '', sort: '', q: '' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn jest useCategoryFilters --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useCategoryFilters.ts`:

```ts
import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CategorySlug } from '../lib/db/heroes';
import {
  type CategoryFilters,
  DEFAULT_FILTERS,
  filtersToParams,
  paramsToFilters,
} from '../lib/db/categoryFilters';

type Single = string | string[] | undefined;
const one = (v: Single): string | undefined => (Array.isArray(v) ? v[0] : v);

export function useCategoryFilters(slug: CategorySlug) {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Seed state once from the URL; thereafter state is the source of truth and
  // we push changes back to the URL (matches app/search.web.tsx).
  const [filters, setFilters] = useState<CategoryFilters>(() =>
    paramsToFilters(slug, {
      publisher: one(params.publisher), alignment: one(params.alignment), gender: one(params.gender),
      stats: one(params.stats), sort: one(params.sort), q: one(params.q),
    }),
  );

  const pushUrl = useCallback(
    (next: CategoryFilters) => {
      const p = filtersToParams(slug, next);
      // Clear keys that fell back to default by sending empty strings.
      router.setParams({
        publisher: p.publisher ?? '', alignment: p.alignment ?? '', gender: p.gender ?? '',
        stats: p.stats ?? '', sort: p.sort ?? '', q: p.q ?? '',
      });
    },
    [router, slug],
  );

  const update = useCallback((next: CategoryFilters) => {
    setFilters(next);
    pushUrl(next);
  }, [pushUrl]);

  const setFilter = useCallback(
    <K extends keyof CategoryFilters>(key: K, value: CategoryFilters[K]) => {
      setFilters((prev) => {
        let next: CategoryFilters = { ...prev, [key]: value };
        if (key === 'sort' && value === 'power') next = { ...next, hasStats: true };
        pushUrl(next);
        return next;
      });
    },
    [pushUrl],
  );

  const reset = useCallback(() => {
    update({ ...DEFAULT_FILTERS, sort: paramsToFilters(slug, {}).sort });
  }, [update, slug]);

  return useMemo(() => ({ filters, setFilter, reset }), [filters, setFilter, reset]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn jest useCategoryFilters --no-coverage`
Expected: PASS. (The `reset` test expects all-empty params; `DEFAULT_FILTERS.sort` is `'popular'` which equals the `popular` slug default, so `sort` serializes to `''`.)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCategoryFilters.ts __tests__/hooks/useCategoryFilters.test.ts
git commit -m "feat(category): useCategoryFilters state-URL hook"
```

---

## Task 5: `FilterControls` — shared facet UI

**Files:**
- Create: `src/components/web/category/FilterControls.tsx`

> No unit test — per CLAUDE.md we don't render-test full UI. Verified visually in Task 7.

- [ ] **Step 1: Implement the component**

Create `src/components/web/category/FilterControls.tsx`. It renders only the facets in `visibleFacets(slug)`, shows counts from `FacetCounts`, and calls `setFilter`. It is presentational — both the rail and the sheet pass the same props.

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import {
  type CategoryFilters, type FacetCounts, type FacetKey,
  visibleFacets,
} from '../../../lib/db/categoryFilters';

type SetFilter = <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;

interface Props {
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: SetFilter;
}

interface Opt { value: string; label: string; count?: number; }

function Group({ title, options, selected, onSelect }: {
  title: string; options: Opt[]; selected: string; onSelect: (v: string) => void;
}) {
  return (
    <View style={s.group}>
      <Text style={s.groupTitle as object}>{title}</Text>
      <View style={s.optionWrap as object}>
        {options.map((o) => {
          const active = o.value === selected;
          const disabled = o.count === 0 && !active;
          return (
            <Pressable
              key={o.value}
              disabled={disabled}
              onPress={() => onSelect(o.value)}
              style={[s.option, active && (s.optionActive as object), disabled && (s.optionDisabled as object)] as object}
            >
              <Text style={[s.optionText, active && (s.optionTextActive as object)] as object}>{o.label}</Text>
              {typeof o.count === 'number' && (
                <Text style={[s.count, active && (s.countActive as object)] as object}>{o.count}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function FilterControls({ slug, filters, counts, setFilter }: Props) {
  const visible = visibleFacets(slug);
  const has = (f: FacetKey) => visible.includes(f);

  return (
    <View style={s.root}>
      <Group
        title="Sort"
        selected={filters.sort}
        onSelect={(v) => setFilter('sort', v as CategoryFilters['sort'])}
        options={[
          { value: 'popular', label: 'Popular' },
          { value: 'az', label: 'A–Z' },
          { value: 'power', label: 'Power' },
        ]}
      />

      {has('publisher') && (
        <Group
          title="Publisher"
          selected={filters.publisher}
          onSelect={(v) => setFilter('publisher', v as CategoryFilters['publisher'])}
          options={[
            { value: 'all', label: 'All', count: counts?.publisher.all },
            { value: 'marvel', label: 'Marvel', count: counts?.publisher.marvel },
            { value: 'dc', label: 'DC', count: counts?.publisher.dc },
            { value: 'other', label: 'Other', count: counts?.publisher.other },
          ]}
        />
      )}

      {has('alignment') && (
        <Group
          title="Alignment"
          selected={filters.alignment}
          onSelect={(v) => setFilter('alignment', v as CategoryFilters['alignment'])}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'good', label: 'Good', count: counts?.alignment.good },
            { value: 'bad', label: 'Bad', count: counts?.alignment.bad },
            { value: 'neutral', label: 'Neutral', count: counts?.alignment.neutral },
          ]}
        />
      )}

      {has('gender') && (
        <Group
          title="Gender"
          selected={filters.gender}
          onSelect={(v) => setFilter('gender', v as CategoryFilters['gender'])}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'male', label: 'Male', count: counts?.gender.male },
            { value: 'female', label: 'Female', count: counts?.gender.female },
          ]}
        />
      )}

      {has('hasStats') && (
        <Group
          title="Powerstats"
          selected={filters.hasStats ? 'yes' : 'any'}
          onSelect={(v) => setFilter('hasStats', v === 'yes')}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'yes', label: 'Has stats', count: counts?.has_stats },
          ]}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 18 },
  group: { gap: 8 },
  groupTitle: {
    fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.6,
    textTransform: 'uppercase', color: 'rgba(245,235,220,0.5)',
  } as object,
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } as object,
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', cursor: 'pointer',
  } as object,
  optionActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.32)' } as object,
  optionDisabled: { opacity: 0.35, cursor: 'default' } as object,
  optionText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' } as object,
  optionTextActive: { color: COLORS.beige } as object,
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.35)' } as object,
  countActive: { color: 'rgba(245,235,220,0.7)' } as object,
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors in `FilterControls.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/web/category/FilterControls.tsx
git commit -m "feat(category): shared FilterControls facet UI"
```

---

## Task 6: `FilterRail`, `FilterSheet`, `ActiveFilterChips`

**Files:**
- Create: `src/components/web/category/FilterRail.tsx`
- Create: `src/components/web/category/FilterSheet.tsx`
- Create: `src/components/web/category/ActiveFilterChips.tsx`

- [ ] **Step 1: Implement `FilterRail` (desktop sidebar)**

Create `src/components/web/category/FilterRail.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import type { CategoryFilters, FacetCounts } from '../../../lib/db/categoryFilters';
import { FilterControls } from './FilterControls';

interface Props {
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
  onReset: () => void;
  hasActive: boolean;
}

export function FilterRail({ slug, filters, counts, setFilter, onReset, hasActive }: Props) {
  return (
    <View style={s.rail as object}>
      <View style={s.header}>
        <Text style={s.title as object}>Filters</Text>
        {hasActive && (
          <Pressable onPress={onReset} style={s.clear as object}>
            <Text style={s.clearText as object}>Clear all</Text>
          </Pressable>
        )}
      </View>
      <FilterControls slug={slug} filters={filters} counts={counts} setFilter={setFilter} />
    </View>
  );
}

const s = StyleSheet.create({
  rail: {
    width: 240, flexShrink: 0, alignSelf: 'flex-start',
    position: 'sticky', top: 200, // 64 nav + ~136 header
    backgroundColor: COLORS.navy, borderRadius: 14,
    padding: 18, gap: 18,
  } as object,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.beige } as object,
  clear: { cursor: 'pointer' } as object,
  clearText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange } as object,
});
```

- [ ] **Step 2: Implement `FilterSheet` (mobile bottom sheet)**

Create `src/components/web/category/FilterSheet.tsx`. On web a fixed-position overlay + bottom panel is enough (no native Modal needed):

```tsx
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import type { CategoryFilters, FacetCounts } from '../../../lib/db/categoryFilters';
import { FilterControls } from './FilterControls';

interface Props {
  open: boolean;
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
  onReset: () => void;
  onClose: () => void;
  total: number;
}

export function FilterSheet({ open, slug, filters, counts, setFilter, onReset, onClose, total }: Props) {
  if (!open) return null;
  return (
    <View style={s.overlay as object}>
      <Pressable style={s.scrim as object} onPress={onClose} />
      <View style={s.sheet as object}>
        <View style={s.grab as object} />
        <View style={s.header}>
          <Text style={s.title as object}>Filters</Text>
          <Pressable onPress={onReset}><Text style={s.clearText as object}>Clear all</Text></Pressable>
        </View>
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent as object}>
          <FilterControls slug={slug} filters={filters} counts={counts} setFilter={setFilter} />
        </ScrollView>
        <Pressable onPress={onClose} style={s.apply as object}>
          <Text style={s.applyText as object}>Show {total.toLocaleString()} result{total !== 1 ? 's' : ''}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'flex-end' } as object,
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' } as object,
  sheet: {
    backgroundColor: COLORS.navy, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '80%', gap: 14,
  } as object,
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,235,220,0.25)' } as object,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.beige } as object,
  clearText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange } as object,
  body: { flexGrow: 0 },
  bodyContent: { paddingVertical: 4 } as object,
  apply: { height: 48, borderRadius: 12, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as object,
  applyText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff' } as object,
});
```

- [ ] **Step 3: Implement `ActiveFilterChips`**

Create `src/components/web/category/ActiveFilterChips.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import {
  type CategoryFilters, type FacetKey, activeFilterList, DEFAULT_FILTERS,
} from '../../../lib/db/categoryFilters';

interface Props {
  slug: CategorySlug;
  filters: CategoryFilters;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
}

const RESET_VALUE: Record<FacetKey, CategoryFilters[keyof CategoryFilters]> = {
  publisher: DEFAULT_FILTERS.publisher,
  alignment: DEFAULT_FILTERS.alignment,
  gender: DEFAULT_FILTERS.gender,
  hasStats: DEFAULT_FILTERS.hasStats,
};

export function ActiveFilterChips({ slug, filters, setFilter }: Props) {
  const chips = activeFilterList(slug, filters);
  if (chips.length === 0) return null;
  return (
    <View style={s.row as object}>
      {chips.map((c) => (
        <Pressable
          key={c.key}
          onPress={() => setFilter(c.key as FacetKey, RESET_VALUE[c.key as FacetKey] as never)}
          style={s.chip as object}
        >
          <Text style={s.text as object}>{c.label}</Text>
          <Text style={s.x as object}>×</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' } as object,
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 28,
    paddingHorizontal: 10, borderRadius: 14,
    backgroundColor: 'rgba(231,115,51,0.18)', borderWidth: 1, borderColor: 'rgba(231,115,51,0.4)', cursor: 'pointer',
  } as object,
  text: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange } as object,
  x: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.orange, lineHeight: 15 } as object,
});
```

- [ ] **Step 4: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors in the three new files.

- [ ] **Step 5: Commit**

```bash
git add src/components/web/category/FilterRail.tsx src/components/web/category/FilterSheet.tsx src/components/web/category/ActiveFilterChips.tsx
git commit -m "feat(category): desktop rail, mobile sheet, active chips"
```

---

## Task 7: Wire the new system into `app/category/[slug].web.tsx`

**Files:**
- Modify: `app/category/[slug].web.tsx`

This replaces the screen's local filter state (`sort`, `publisher`, `search`, the inline pill/segment rows) with `useCategoryFilters` + the new components, and adds a facet-counts fetch. The grid, skeleton, `HeroCard`, and infinite scroll are kept as-is (including the `width: '100%'` WebKit fix).

- [ ] **Step 1: Replace state, fetching, and imports**

In `app/category/[slug].web.tsx`:

1. Add imports:

```tsx
import { useCategoryFilters } from '../../src/hooks/useCategoryFilters';
import { getCategoryPage, getCategoryFacetCounts, /* keep existing */ } from '../../src/lib/db/heroes';
import { activeFilterList, type CategoryFilters, type FacetCounts } from '../../src/lib/db/categoryFilters';
import { FilterRail } from '../../src/components/web/category/FilterRail';
import { FilterSheet } from '../../src/components/web/category/FilterSheet';
import { ActiveFilterChips } from '../../src/components/web/category/ActiveFilterChips';
```

2. Inside `WebCategoryScreen`, remove the old `sort`/`publisher`/`search`/`searchFocused` state plus `handleSort`/`handlePublisher` and the SORT_OPTS/PUB_OPTS arrays. Replace with:

```tsx
const { filters, setFilter, reset } = useCategoryFilters(categorySlug ?? 'popular');
const [counts, setCounts] = useState<FacetCounts | null>(null);
const [sheetOpen, setSheetOpen] = useState(false);
```

3. Replace `fetchPage`'s `opts` param to take `CategoryFilters`. Update the call signature so it passes the whole `filters` object:

```tsx
const fetchPage = useCallback(
  async (page: number, f: CategoryFilters, append = false) => {
    if (!categorySlug) return;
    if (page === 0) setLoading(true); else setLoadingMore(true);
    try {
      const result = await getCategoryPage(categorySlug, { page, pageSize: PAGE_SIZE, ...f });
      setHeroes((prev) => {
        if (!append) return result.heroes;
        const seen = new Set(prev.map((h) => h.id));
        return [...prev, ...result.heroes.filter((h) => !seen.has(h.id))];
      });
      setTotal(result.total);
      currentPage.current = page;
      hasMore.current = (page + 1) * PAGE_SIZE < result.total;
    } catch { /* */ } finally { setLoading(false); setLoadingMore(false); }
  },
  [categorySlug],
);
```

4. Replace the mount effect + add a filter-change effect (debounced for `search`, immediate for facets). Use a ref to debounce only search:

```tsx
const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

// Refetch page 0 + facet counts whenever filters change. Search is debounced.
useEffect(() => {
  if (!categorySlug) return;
  clearTimeout(searchTimer.current);
  searchTimer.current = setTimeout(() => {
    fetchPage(0, filters);
    getCategoryFacetCounts(categorySlug, filters).then(setCounts).catch(() => setCounts(null));
  }, filters.search ? 300 : 0);
  return () => clearTimeout(searchTimer.current);
}, [categorySlug, filters, fetchPage]);
```

5. Update `handleScroll` to pass `filters` instead of `{ sort, publisher, search }`:

```tsx
fetchPage(currentPage.current + 1, filters, true);
```
and its dependency array to `[fetchPage, filters]`.

6. Update the search `TextInput` to use `filters.search` / `setFilter('search', t)`:

```tsx
value={filters.search}
onChangeText={(t) => setFilter('search', t)}
```

- [ ] **Step 2: Replace the header controls row + grid layout**

Replace the entire `controlsRow` block (the inline segment/chip rows, both desktop and mobile branches) with: the search bar, an `ActiveFilterChips`, and — on mobile — a "Filters" button that opens the sheet. Then wrap the content so desktop shows `FilterRail` beside the grid.

Replace the JSX from the start of `{/* Row 2 — controls */}` through the end of the content section with:

```tsx
{/* Row 2 — search + active chips (+ Filters button on mobile) */}
<View style={[styles.controlsRow, !isDesktop && (styles.controlsRowMobile as object)] as object}>
  <View style={[styles.searchBar, !isDesktop && (styles.searchBarMobile as object)] as object}>
    <Ionicons name="search-outline" size={14} color="rgba(245,235,220,0.35)" />
    <TextInput
      style={styles.searchInput as object}
      placeholder={`Search ${title.toLowerCase()}…`}
      placeholderTextColor="rgba(245,235,220,0.3)"
      value={filters.search}
      onChangeText={(t) => setFilter('search', t)}
      autoCorrect={false}
    />
  </View>
  {!isDesktop && (
    <Pressable onPress={() => setSheetOpen(true)} style={styles.filterBtn as object}>
      <Ionicons name="options-outline" size={16} color={COLORS.beige} />
      <Text style={styles.filterBtnText as object}>Filters</Text>
      {activeFilterList(categorySlug ?? 'popular', filters).length > 0 && (
        <View style={styles.filterBadge as object}>
          <Text style={styles.filterBadgeText as object}>{activeFilterList(categorySlug ?? 'popular', filters).length}</Text>
        </View>
      )}
    </Pressable>
  )}
</View>
{categorySlug && (
  <ActiveFilterChips slug={categorySlug} filters={filters} setFilter={setFilter} />
)}
```

Then change the content region so the desktop layout is `rail + grid`. Wrap the existing loading/empty/grid `ScrollView` in a row container:

```tsx
{/* ── Content: desktop = rail + grid; mobile = grid only ── */}
<View style={[styles.contentRow, { paddingHorizontal: contentPad }] as object}>
  {isDesktop && categorySlug && (
    <FilterRail
      slug={categorySlug}
      filters={filters}
      counts={counts}
      setFilter={setFilter}
      onReset={reset}
      hasActive={activeFilterList(categorySlug, filters).length > 0}
    />
  )}
  <View style={styles.contentMain as object}>
    {/* existing loading / empty / ScrollView+grid JSX goes here, but
        remove the per-block `paddingHorizontal: contentPad` since the row
        now owns horizontal padding. Keep paddingBottom on the grid. */}
  </View>
</View>

{/* Mobile filter sheet */}
{categorySlug && (
  <FilterSheet
    open={sheetOpen}
    slug={categorySlug}
    filters={filters}
    counts={counts}
    setFilter={setFilter}
    onReset={reset}
    onClose={() => setSheetOpen(false)}
    total={total}
  />
)}
```

- [ ] **Step 3: Add the new styles**

Add to the `styles` StyleSheet (and delete styles only used by the removed segment/chip/pills code — `segmentGroup`, `segment*`, `chips`, `chip*`, `dividerV`, `pillsRow`, `pillsScrollContent`):

```tsx
contentRow: { flexDirection: 'row', gap: 24, maxWidth: 1200, width: '100%', alignSelf: 'center', flex: 1 } as object,
contentMain: { flex: 1, minWidth: 0 } as object,
filterBtn: {
  flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 14,
  borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', cursor: 'pointer', flexShrink: 0,
} as object,
filterBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige } as object,
filterBadge: {
  minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
  backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center',
} as object,
filterBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' } as object,
```

Note: the `gridWrap`/`scroll` styles stay; just ensure the grid container no longer double-applies `contentPad` now that `contentRow` owns it. The `gridStyle` (CSS grid) and `HeroCard`/`SkeletonCard` (with `width: '100%'`) are unchanged.

- [ ] **Step 4: Typecheck + run all tests**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: no TS errors; all Jest suites pass.

- [ ] **Step 5: Verify in Chromium (desktop + emulated mobile)**

Start the dev server if not running (`yarn start --web` or the existing server on :8081). Using the Playwright MCP:
- Navigate to `http://localhost:8081/category/villain` at 1280px wide → filter rail visible on the left, grid on the right, alignment facet **absent** (villain), publisher/gender/powerstats present with counts.
- Click "Marvel" publisher → grid refetches, counts update, a "Marvel" chip appears, URL gains `?publisher=marvel`.
- Resize to 390px → rail gone, "Filters" button visible; open sheet, choose Female, tap "Show N results" → sheet closes, chip shows, grid filtered.

- [ ] **Step 6: Verify in real WebKit (the original bug's engine)**

Write a short script using the downloaded WebKit (`~/Library/Caches/ms-playwright/webkit-2287`) — same approach used to diagnose the grid bug — to load `/category/villain` at 390×844, wait for network idle, and assert hero `img` count > 0 and that the filter button is present. Expected: heroes render, no 0×0 collapse, filtering works.

- [ ] **Step 7: Commit**

```bash
git add "app/category/[slug].web.tsx"
git commit -m "feat(category): wire filter rail + sheet + chips into web screen"
```

---

## Task 8: Final verification & branch wrap-up

- [ ] **Step 1: Full test + typecheck + lint**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint`
Expected: all green. (If `yarn lint` is not defined, skip it.)

- [ ] **Step 2: Confirm no leftover references to removed types**

Run: `grep -rn "CategoryPublisher\|handlePublisher\|handleSort\|SORT_OPTS\|PUB_OPTS" app src`
Expected: no matches (all removed). Fix any stragglers.

- [ ] **Step 3: Self-review the diff**

Run: `git diff master --stat` and skim `git diff master -- "app/category/[slug].web.tsx"`. Confirm the WebKit `width: '100%'` fix is still present on `card.wrap` and `sk.wrap`.

- [ ] **Step 4: Push the branch (only if the user asks)**

Do not push or open a PR unless the user requests it.

---

## Self-Review (completed during planning)

- **Spec coverage:** honest+adaptive counts (Task 1 RPC + Task 5 count display) ✓; filter set publisher/alignment/gender/hasStats/sort (Tasks 2,3,5) ✓; mobile sheet (Task 6) ✓; desktop rail (Task 6) ✓; shared state model (Task 4) ✓; URL state (Tasks 2,4) ✓; per-option counts via RPC (Task 1,3) ✓; generated `powerstats_total` + Power sort + getHeroesByPowerRange fix (Task 1,3) ✓; category-aware facet visibility (Task 2) ✓; web-only with extracted logic (Tasks 2–4 are platform-agnostic) ✓; tests with mocked Supabase, no screen render tests (Tasks 2,3,4) ✓.
- **Type consistency:** `CategoryFilters`, `FacetCounts`, `FacetKey`, `SortOption ('popular'|'az'|'power')`, `visibleFacets`, `filtersToParams`/`paramsToFilters`, `getCategoryPage(slug, {page,pageSize,...filters})`, `getCategoryFacetCounts(slug, filters)`, RPC param names `p_slug/p_publisher/p_alignment/p_gender/p_has_stats/p_search` — consistent across Tasks 1–7.
- **Placeholders:** none — all steps contain concrete code/SQL/commands.
```
