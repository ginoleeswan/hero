# Hero DB Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-populate Supabase with all 731 heroes and their full data so the search screen and character detail screen make zero external API calls.

**Architecture:** A DB migration adds ~25 new columns to `heroes`. A one-shot Bun script fetches the CDN `all.json` (1 request) and upserts all 731 heroes. The app's search screen and character detail screen are updated to query Supabase first, falling back to the existing API calls only for un-enriched heroes.

**Tech Stack:** Supabase (Postgres + JS client), Bun scripts, React Native / Expo Router, TypeScript

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260404120000_enrich_heroes.sql` | Create | Adds all new columns to `heroes` table |
| `src/types/database.generated.ts` | Regenerate (MCP) | Updated types after migration |
| `scripts/enrich-heroes.ts` | Create | Phase 1: CDN bulk upsert (731 heroes, 1 HTTP request) |
| `scripts/enrich-comicvine.ts` | Create | Phase 2: ComicVine summary + first issue image, throttled |
| `src/lib/db/heroes.ts` | Modify | Add `getHeroById`, `searchHeroes`, `HeroSearchResult` type, `heroRowToCharacterData` |
| `__tests__/lib/db/heroes.test.ts` | Create | Unit tests for `getHeroById` and `searchHeroes` |
| `app/(tabs)/search.tsx` | Modify | Replace CDN fetch + client-side filter with `searchHeroes` |
| `app/character/[id].tsx` | Modify | Supabase-first load path using `getHeroById` + `heroRowToCharacterData` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260404120000_enrich_heroes.sql`
- Regenerate: `src/types/database.generated.ts`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260404120000_enrich_heroes.sql
alter table heroes
  -- images (image_url stays as the large/detail image)
  add column if not exists image_md_url        text,

  -- powerstats (nullable integer — CDN returns null for unknowns)
  add column if not exists intelligence        integer,
  add column if not exists strength            integer,
  add column if not exists speed               integer,
  add column if not exists durability          integer,
  add column if not exists power               integer,
  add column if not exists combat              integer,

  -- biography
  add column if not exists full_name           text,
  add column if not exists alter_egos          text,
  add column if not exists aliases             text[],
  add column if not exists place_of_birth      text,
  add column if not exists first_appearance    text,
  add column if not exists alignment           text,

  -- appearance
  add column if not exists gender              text,
  add column if not exists race                text,
  add column if not exists height_imperial     text,
  add column if not exists height_metric       text,
  add column if not exists weight_imperial     text,
  add column if not exists weight_metric       text,
  add column if not exists eye_color           text,
  add column if not exists hair_color          text,

  -- work
  add column if not exists occupation          text,
  add column if not exists base                text,

  -- connections
  add column if not exists group_affiliation   text,
  add column if not exists relatives           text,

  -- comicvine (phase 2 — null until enriched)
  add column if not exists summary                  text,
  add column if not exists first_issue_image_url    text,
  add column if not exists comicvine_enriched_at    timestamptz,

  -- enrichment tracking
  add column if not exists enriched_at         timestamptz;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- `name`: `enrich_heroes`
- `query`: the full SQL above

Expected: migration applied successfully, no errors.

- [ ] **Step 3: Regenerate TypeScript types via Supabase MCP**

Use `mcp__supabase__generate_typescript_types` and write the output to `src/types/database.generated.ts`.

Expected: the `heroes` Row type now includes all new columns (`intelligence`, `strength`, `full_name`, `enriched_at`, etc.).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260404120000_enrich_heroes.sql src/types/database.generated.ts
git commit -m "feat(db): add enrichment columns to heroes table"
```

---

## Task 2: Phase 1 Enrichment Script

**Files:**
- Create: `scripts/enrich-heroes.ts`

The script uses its own Supabase client (cannot import `src/lib/supabase.ts` — that file imports `react-native` which doesn't run in plain Bun).

The CDN JSON (`akabab/superhero-api`) uses camelCase for some fields: `eyeColor`, `hairColor`, `fullName`, `alterEgos`, `placeOfBirth`, `firstAppearance`, `groupAffiliation`. Map them to snake_case DB columns.

Powerstats values in the CDN JSON are integers or `null` (not strings — different from SuperheroAPI). Store `null` for any `null` value.

- [ ] **Step 1: Write the script**

```ts
// scripts/enrich-heroes.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.generated';

const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
);

const CDN_URL = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json';
const BATCH_SIZE = 50;

interface CdnHero {
  id: number;
  name: string;
  powerstats: {
    intelligence: number | null;
    strength: number | null;
    speed: number | null;
    durability: number | null;
    power: number | null;
    combat: number | null;
  };
  biography: {
    fullName: string;
    alterEgos: string;
    aliases: string[];
    placeOfBirth: string;
    firstAppearance: string;
    publisher: string;
    alignment: string;
  };
  appearance: {
    gender: string;
    race: string;
    height: [string, string];
    weight: [string, string];
    eyeColor: string;
    hairColor: string;
  };
  work: { occupation: string; base: string };
  connections: { groupAffiliation: string; relatives: string };
  images: { xs: string; sm: string; md: string; lg: string };
}

function mapHero(h: CdnHero) {
  return {
    id: String(h.id),
    name: h.name,
    image_url: h.images.lg,
    image_md_url: h.images.md,
    intelligence: h.powerstats.intelligence ?? null,
    strength: h.powerstats.strength ?? null,
    speed: h.powerstats.speed ?? null,
    durability: h.powerstats.durability ?? null,
    power: h.powerstats.power ?? null,
    combat: h.powerstats.combat ?? null,
    full_name: h.biography.fullName || null,
    alter_egos: h.biography.alterEgos || null,
    aliases: h.biography.aliases.filter(Boolean),
    place_of_birth: h.biography.placeOfBirth || null,
    first_appearance: h.biography.firstAppearance || null,
    publisher: h.biography.publisher || null,
    alignment: h.biography.alignment || null,
    gender: h.appearance.gender || null,
    race: h.appearance.race || null,
    height_imperial: h.appearance.height[0] || null,
    height_metric: h.appearance.height[1] || null,
    weight_imperial: h.appearance.weight[0] || null,
    weight_metric: h.appearance.weight[1] || null,
    eye_color: h.appearance.eyeColor || null,
    hair_color: h.appearance.hairColor || null,
    occupation: h.work.occupation || null,
    base: h.work.base || null,
    group_affiliation: h.connections.groupAffiliation || null,
    relatives: h.connections.relatives || null,
    enriched_at: new Date().toISOString(),
  };
}

async function main() {
  const targetId = process.argv.includes('--id')
    ? process.argv[process.argv.indexOf('--id') + 1]
    : null;

  console.log('Fetching CDN all.json...');
  const res = await fetch(CDN_URL);
  if (!res.ok) throw new Error(`CDN fetch failed: ${res.status}`);
  let heroes: CdnHero[] = await res.json();
  console.log(`Fetched ${heroes.length} heroes.`);

  if (targetId) {
    heroes = heroes.filter((h) => String(h.id) === targetId);
    if (heroes.length === 0) throw new Error(`Hero ${targetId} not found in CDN data`);
    console.log(`Filtered to hero ${targetId}: ${heroes[0].name}`);
  }

  const rows = heroes.map(mapHero);
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`Upserting ${rows.length} heroes in ${batches.length} batches...`);
  let done = 0;
  for (const batch of batches) {
    const { error } = await supabase
      .from('heroes')
      .upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    done += batch.length;
    console.log(`  ${done}/${rows.length} done`);
  }

  console.log('Enrichment complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script**

```bash
bun scripts/enrich-heroes.ts
```

Expected output:
```
Fetching CDN all.json...
Fetched 731 heroes.
Upserting 731 heroes in 15 batches...
  50/731 done
  100/731 done
  ...
  731/731 done
Enrichment complete.
```

- [ ] **Step 3: Spot-check in Supabase**

Run a quick verification query using `mcp__supabase__execute_sql`:
```sql
select id, name, intelligence, strength, full_name, enriched_at
from heroes
where name = 'Spider-Man';
```

Expected: row with `intelligence`, `strength` populated and `enriched_at` set.

Also check total enriched count:
```sql
select count(*) from heroes where enriched_at is not null;
```

Expected: 731.

- [ ] **Step 4: Commit**

```bash
git add scripts/enrich-heroes.ts
git commit -m "feat(scripts): add Phase 1 hero enrichment script"
```

---

## Task 3: DB query functions + tests

**Files:**
- Modify: `src/lib/db/heroes.ts`
- Create: `__tests__/lib/db/heroes.test.ts`

Add three exports to `heroes.ts`:
- `HeroSearchResult` — partial type for search list rows
- `getHeroById(id)` — fetch one fully-enriched hero row
- `searchHeroes(query, publisher)` — server-side search with publisher filter
- `heroRowToCharacterData(hero)` — maps a Hero DB row to the `CharacterData` shape expected by `app/character/[id].tsx`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/db/heroes.test.ts
import {
  getHeroById,
  searchHeroes,
  heroRowToCharacterData,
} from '../../../src/lib/db/heroes';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
//
// Supabase's query builder is "thenable" — it can be both chained and awaited.
// We replicate this by adding a `then` method to the chain object so that
// `await q` resolves with whatever `resolveWith` was set to last.
//
let resolveWith: { data: unknown; error: unknown } = { data: null, error: null };

const chain: Record<string, unknown> = {};
const chainMethods = ['select', 'eq', 'ilike', 'not', 'order', 'limit'];
chainMethods.forEach((m) => {
  chain[m] = jest.fn().mockReturnValue(chain);
});
// single() returns a real Promise (used by getHeroById)
chain.single = jest.fn(() => Promise.resolve(resolveWith));
// then() makes the whole chain awaitable (used by searchHeroes)
chain.then = (resolve: (v: unknown) => unknown) =>
  Promise.resolve(resolveWith).then(resolve);

const mockFrom = jest.fn().mockReturnValue(chain);

jest.mock('../../../src/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

beforeEach(() => {
  jest.clearAllMocks();
  chainMethods.forEach((m) => (chain[m] as jest.Mock).mockReturnValue(chain));
  (chain.single as jest.Mock).mockImplementation(() => Promise.resolve(resolveWith));
  resolveWith = { data: null, error: null };
  mockFrom.mockReturnValue(chain);
});

// ─── getHeroById ─────────────────────────────────────────────────────────────

describe('getHeroById', () => {
  it('returns the hero when found', async () => {
    const hero = { id: '620', name: 'Spider-Man', enriched_at: '2026-04-04T00:00:00Z' };
    resolveWith = { data: hero, error: null };

    const result = await getHeroById('620');
    expect(result).toEqual(hero);
    expect(mockFrom).toHaveBeenCalledWith('heroes');
    expect(chain.eq as jest.Mock).toHaveBeenCalledWith('id', '620');
  });

  it('returns null when hero not found', async () => {
    resolveWith = { data: null, error: null };
    const result = await getHeroById('999');
    expect(result).toBeNull();
  });
});

// ─── searchHeroes ─────────────────────────────────────────────────────────────

describe('searchHeroes', () => {
  it('queries by name when query is non-empty', async () => {
    resolveWith = { data: [], error: null };
    await searchHeroes('spider', 'All');
    expect(chain.ilike as jest.Mock).toHaveBeenCalledWith('name', '%spider%');
  });

  it('does not add ilike name filter when query is empty', async () => {
    resolveWith = { data: [], error: null };
    await searchHeroes('', 'All');
    expect(chain.ilike as jest.Mock).not.toHaveBeenCalled();
  });

  it('filters by Marvel publisher', async () => {
    resolveWith = { data: [], error: null };
    await searchHeroes('', 'Marvel');
    expect(chain.ilike as jest.Mock).toHaveBeenCalledWith('publisher', '%marvel%');
  });

  it('filters by DC publisher', async () => {
    resolveWith = { data: [], error: null };
    await searchHeroes('', 'DC');
    expect(chain.ilike as jest.Mock).toHaveBeenCalledWith('publisher', '%dc%');
  });

  it('excludes Marvel and DC for Other filter', async () => {
    resolveWith = { data: [], error: null };
    await searchHeroes('', 'Other');
    expect(chain.not as jest.Mock).toHaveBeenCalledWith('publisher', 'ilike', '%marvel%');
    expect(chain.not as jest.Mock).toHaveBeenCalledWith('publisher', 'ilike', '%dc%');
  });

  it('throws on Supabase error', async () => {
    resolveWith = { data: null, error: { message: 'DB error' } };
    await expect(searchHeroes('', 'All')).rejects.toThrow('DB error');
  });
});

// ─── heroRowToCharacterData ──────────────────────────────────────────────────

describe('heroRowToCharacterData', () => {
  const hero = {
    id: '620',
    name: 'Spider-Man',
    category: 'popular',
    publisher: 'Marvel Comics',
    image_url: 'https://cdn.example.com/lg.jpg',
    image_md_url: 'https://cdn.example.com/md.jpg',
    intelligence: 90,
    strength: 55,
    speed: 67,
    durability: 75,
    power: 74,
    combat: 85,
    full_name: 'Peter Parker',
    alter_egos: 'No alter egos found.',
    aliases: ['Spidey', 'Web-Slinger'],
    place_of_birth: 'New York',
    first_appearance: 'Amazing Fantasy #15',
    alignment: 'good',
    gender: 'Male',
    race: 'Human',
    height_imperial: "5'10",
    height_metric: '178 cm',
    weight_imperial: '167 lb',
    weight_metric: '76 kg',
    eye_color: 'Hazel',
    hair_color: 'Brown',
    occupation: 'Freelance photographer',
    base: 'New York',
    group_affiliation: 'Avengers',
    relatives: 'Richard Parker (father)',
    summary: 'A bite from a radioactive spider gave Peter Parker amazing abilities.',
    first_issue_image_url: 'https://cdn.example.com/issue.jpg',
    comicvine_enriched_at: '2026-04-04T00:00:00Z',
    enriched_at: '2026-04-04T00:00:00Z',
  } as any;

  it('maps powerstats to string values', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.stats.powerstats.intelligence).toBe('90');
    expect(data.stats.powerstats.strength).toBe('55');
  });

  it('maps null powerstats to "0"', () => {
    const data = heroRowToCharacterData({ ...hero, intelligence: null });
    expect(data.stats.powerstats.intelligence).toBe('0');
  });

  it('maps biography fields with hyphenated keys', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.stats.biography['full-name']).toBe('Peter Parker');
    expect(data.stats.biography['place-of-birth']).toBe('New York');
    expect(data.stats.biography.aliases).toEqual(['Spidey', 'Web-Slinger']);
  });

  it('maps appearance fields with hyphenated keys', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.stats.appearance['eye-color']).toBe('Hazel');
    expect(data.stats.appearance.height).toEqual(["5'10", '178 cm']);
  });

  it('maps comicvine fields', () => {
    const data = heroRowToCharacterData(hero);
    expect(data.details.summary).toBe('A bite from a radioactive spider gave Peter Parker amazing abilities.');
    expect(data.firstIssue?.imageUrl).toBe('https://cdn.example.com/issue.jpg');
  });

  it('returns null firstIssue when first_issue_image_url is null', () => {
    const data = heroRowToCharacterData({ ...hero, first_issue_image_url: null });
    expect(data.firstIssue).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test:ci -- __tests__/lib/db/heroes.test.ts
```

Expected: multiple failures — `getHeroById`, `searchHeroes`, `heroRowToCharacterData` not exported.

- [ ] **Step 3: Implement the new exports in `src/lib/db/heroes.ts`**

Replace the full file content:

```ts
import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';
import type { CharacterData } from '../../types';

export type Hero = Tables<'heroes'>;
export type HeroCategory = 'popular' | 'villain' | 'xmen';
export type PublisherFilter = 'All' | 'Marvel' | 'DC' | 'Other';
export type HeroSearchResult = Pick<Hero, 'id' | 'name' | 'publisher' | 'image_md_url' | 'image_url'>;

export interface HeroesByCategory {
  popular: Hero[];
  villain: Hero[];
  xmen: Hero[];
}

export async function getHeroesByCategory(): Promise<HeroesByCategory> {
  const { data, error } = await supabase.from('heroes').select('*').order('name');
  if (error) throw error;
  return {
    popular: data.filter((h) => h.category === 'popular'),
    villain: data.filter((h) => h.category === 'villain'),
    xmen: data.filter((h) => h.category === 'xmen'),
  };
}

export async function getHeroById(id: string): Promise<Hero | null> {
  const { data } = await supabase
    .from('heroes')
    .select('*')
    .eq('id', id)
    .single();
  return data ?? null;
}

export async function searchHeroes(
  query: string,
  publisher: PublisherFilter,
): Promise<HeroSearchResult[]> {
  let q = supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, image_url')
    .order('name')
    .limit(100);

  if (query.trim()) q = q.ilike('name', `%${query}%`) as typeof q;

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

export function heroRowToCharacterData(hero: Hero): CharacterData {
  const stat = (v: number | null) => String(v ?? 0);
  return {
    stats: {
      id: hero.id,
      name: hero.name,
      powerstats: {
        intelligence: stat(hero.intelligence),
        strength: stat(hero.strength),
        speed: stat(hero.speed),
        durability: stat(hero.durability),
        power: stat(hero.power),
        combat: stat(hero.combat),
      },
      biography: {
        'full-name': hero.full_name ?? '',
        'alter-egos': hero.alter_egos ?? '',
        aliases: hero.aliases ?? [],
        'place-of-birth': hero.place_of_birth ?? '',
        'first-appearance': hero.first_appearance ?? '',
        publisher: hero.publisher ?? '',
        alignment: hero.alignment ?? '',
      },
      appearance: {
        gender: hero.gender ?? '',
        race: hero.race ?? '',
        height: [hero.height_imperial ?? '', hero.height_metric ?? ''],
        weight: [hero.weight_imperial ?? '', hero.weight_metric ?? ''],
        'eye-color': hero.eye_color ?? '',
        'hair-color': hero.hair_color ?? '',
      },
      work: {
        occupation: hero.occupation ?? '',
        base: hero.base ?? '',
      },
      connections: {
        'group-affiliation': hero.group_affiliation ?? '',
        relatives: hero.relatives ?? '',
      },
      image: {
        url: hero.image_url ?? '',
      },
    },
    details: {
      summary: hero.summary ?? null,
      publisher: hero.publisher ?? null,
      firstIssueId: null,
    },
    firstIssue: hero.first_issue_image_url
      ? { id: '', imageUrl: hero.first_issue_image_url }
      : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test:ci -- __tests__/lib/db/heroes.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
bun run test:ci
```

Expected: all tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.test.ts
git commit -m "feat(db): add getHeroById, searchHeroes, heroRowToCharacterData"
```

---

## Task 4: Update Search Screen

**Files:**
- Modify: `app/(tabs)/search.tsx`

Replace the CDN fetch + in-memory filter with `searchHeroes`. The debounce (150ms) stays. Publisher pill state stays. The screen re-queries whenever `debouncedQuery` or `publisherFilter` changes.

Key changes:
- Remove `allHeroes` state and `CdnHero` type
- Remove `loadHeroes` callback and its `useEffect`
- Add `results` state and a `useEffect` that calls `searchHeroes`
- Update `handlePress` — image URI comes from `item.image_url` (was `item.images.lg`)
- Update list `renderItem` — avatar comes from `item.image_md_url` (was `item.images.md`)

- [ ] **Step 1: Replace the search screen**

```tsx
// app/(tabs)/search.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { SearchSkeleton } from '../../src/components/skeletons/SearchSkeleton';
import { searchHeroes } from '../../src/lib/db/heroes';
import type { HeroSearchResult, PublisherFilter } from '../../src/lib/db/heroes';

const PUBLISHER_PILLS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];

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
  const inputRef = useRef<TextInput>(null);

  const [results, setResults] = useState<HeroSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const [retryCount, setRetryCount] = useState(0);

  const debouncedQuery = useDebounce(query, 150);

  useEffect(() => {
    setLoadingList(true);
    setError(false);
    searchHeroes(debouncedQuery, publisherFilter)
      .then(setResults)
      .catch(() => setError(true))
      .finally(() => setLoadingList(false));
  }, [debouncedQuery, publisherFilter, retryCount]);

  const handlePress = useCallback(
    (id: string, name: string, imageUri: string) => {
      if (navigatingId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigatingId(id);
      inputRef.current?.blur();
      router.push({
        pathname: '/character/[id]',
        params: { id, name, imageUri },
      });
      setTimeout(() => setNavigatingId(null), 1000);
    },
    [router, navigatingId],
  );

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handlePillPress = (pill: PublisherFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPublisherFilter(pill);
  };

  const resultLabel = loadingList
    ? ''
    : error
      ? ''
      : `${results.length} result${results.length !== 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>search</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.beige} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search heroes…"
            placeholderTextColor="rgba(245,235,220,0.5)"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={clearQuery}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.6)" />
            </TouchableOpacity>
          )}
        </View>

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
                onPress={() => handlePillPress(pill)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{pill}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!loadingList && !error && <Text style={styles.resultCount}>{resultLabel}</Text>}

        {loadingList ? (
          <SearchSkeleton />
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="wifi-outline" size={40} color={COLORS.grey} />
            <Text style={styles.errorText}>Couldn't load heroes</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setRetryCount((c) => c + 1)}
              activeOpacity={0.8}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(h) => h.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isNavigating = navigatingId === item.id;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => handlePress(item.id, item.name, item.image_url ?? '')}
                  activeOpacity={0.7}
                  disabled={!!navigatingId}
                >
                  <Image
                    source={{ uri: item.image_md_url ?? item.image_url ?? undefined }}
                    style={styles.avatar}
                    contentFit="cover"
                    placeholder="#d4c8b8"
                    transition={200}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.heroName}>{item.name}</Text>
                    {item.publisher ? (
                      <Text style={styles.publisher}>{item.publisher}</Text>
                    ) : null}
                  </View>
                  {isNavigating ? (
                    <ActivityIndicator size="small" color={COLORS.orange} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={COLORS.grey} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No heroes found</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontFamily: 'Righteous_400Regular', fontSize: 50, color: COLORS.navy },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.beige },
  pillsScroll: { flexGrow: 0, height: 48, marginBottom: 10 },
  pillsContainer: { paddingHorizontal: 15, paddingVertical: 4, gap: 8, alignItems: 'center' },
  pill: {
    height: 36,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
  },
  pillActive: { backgroundColor: COLORS.navy },
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  pillTextActive: { color: COLORS.beige },
  resultCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  list: { paddingHorizontal: 15, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.navy,
    marginRight: 14,
  },
  rowText: { flex: 1 },
  heroName: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy },
  publisher: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, marginTop: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d4c8b8',
    marginLeft: AVATAR_SIZE + 14,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: 'FlameSans-Regular', fontSize: 15, color: COLORS.grey },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 15, color: COLORS.grey },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.navy, borderRadius: 20 },
  retryText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: COLORS.beige },
});
```

- [ ] **Step 2: Run the full test suite**

```bash
bun run test:ci
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/search.tsx
git commit -m "feat(search): replace CDN fetch with Supabase searchHeroes query"
```

---

## Task 5: Update Character Detail Screen

**Files:**
- Modify: `app/character/[id].tsx`

Replace the three-API `useEffect` with a Supabase-first path. If the hero row has `enriched_at` set, use `heroRowToCharacterData` and skip all external calls. If not enriched, fall back to the existing SuperheroAPI → ComicVine chain unchanged.

Only the `useEffect` that loads character data changes. Everything else (parallax, header, render, styles) is untouched.

- [ ] **Step 1: Update the data-loading `useEffect` in `app/character/[id].tsx`**

Find and replace the existing `useEffect` that starts with `if (!id) return;` (lines ~151–177). The new version:

```tsx
useEffect(() => {
  if (!id) return;

  // Try Supabase first — instant if hero is enriched
  getHeroById(id).then((hero) => {
    if (hero?.enriched_at) {
      setData(heroRowToCharacterData(hero));
      setComicVineLoading(!hero.comicvine_enriched_at);

      // If ComicVine not enriched yet, fetch it in background
      if (!hero.comicvine_enriched_at) {
        fetchHeroDetails(hero.name)
          .then(async (details) => {
            const firstIssue = details.firstIssueId
              ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
              : null;
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    details,
                    firstIssue: firstIssue ?? prev.firstIssue,
                  }
                : prev,
            );
          })
          .catch(() => {})
          .finally(() => setComicVineLoading(false));
      }
      return;
    }

    // Fallback — hero not enriched yet, use external APIs
    fetchHeroStats(id)
      .then((stats) => {
        setData({
          stats,
          details: { summary: null, publisher: null, firstIssueId: null },
          firstIssue: null,
        });
        fetchHeroDetails(stats.name)
          .then(async (details) => {
            const firstIssue = details.firstIssueId
              ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
              : null;
            setData({ stats, details, firstIssue });
          })
          .catch(() => {})
          .finally(() => setComicVineLoading(false));
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load character');
      });
  });
}, [id]);
```

- [ ] **Step 2: Add the import for `getHeroById` and `heroRowToCharacterData`**

Find the existing import line:
```tsx
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
```

Add below it:
```tsx
import { getHeroById, heroRowToCharacterData } from '../../src/lib/db/heroes';
```

- [ ] **Step 3: Run the full test suite**

```bash
bun run test:ci
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/character/[id].tsx
git commit -m "feat(character): load from Supabase first, fall back to APIs for un-enriched heroes"
```

---

## Task 6: Phase 2 ComicVine Enrichment Script

**Files:**
- Create: `scripts/enrich-comicvine.ts`

Designed to run overnight. Throttled to 20 seconds between heroes (~180/hr, safely under the 200/hr ComicVine limit). Fully resumable — skips heroes where `comicvine_enriched_at IS NOT NULL` unless `--force` flag is passed.

Reads `COMICVINE_API_KEY` from env (set in `.env.local`).

- [ ] **Step 1: Write the script**

```ts
// scripts/enrich-comicvine.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.generated';

const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
);

const COMICVINE_KEY = process.env.COMICVINE_API_KEY!;
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';
const DELAY_MS = 20_000; // 20s → ~180 requests/hr, under the 200/hr limit

const force = process.argv.includes('--force');

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchComicVine(name: string): Promise<{
  summary: string | null;
  firstIssueId: string | null;
}> {
  const params = new URLSearchParams({
    api_key: COMICVINE_KEY,
    format: 'json',
    filter: `name:${name}`,
    field_list: 'deck,first_appeared_in_issue',
    limit: '1',
  });
  const res = await fetch(`${COMICVINE_BASE}/characters/?${params}`);
  if (!res.ok) throw new Error(`ComicVine characters error: ${res.status}`);
  const json = await res.json();
  const result = json.results?.[0];
  if (!result) return { summary: null, firstIssueId: null };
  return {
    summary: result.deck ?? null,
    firstIssueId: result.first_appeared_in_issue?.id
      ? String(result.first_appeared_in_issue.id)
      : null,
  };
}

async function fetchIssueImage(issueId: string): Promise<string | null> {
  const params = new URLSearchParams({
    api_key: COMICVINE_KEY,
    format: 'json',
    field_list: 'image',
  });
  const res = await fetch(`${COMICVINE_BASE}/issue/4000-${issueId}/?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.results?.image?.medium_url ?? null;
}

async function main() {
  if (!COMICVINE_KEY) throw new Error('COMICVINE_API_KEY not set in environment');

  let query = supabase.from('heroes').select('id, name').order('name');
  if (!force) query = query.is('comicvine_enriched_at', null) as typeof query;

  const { data: heroes, error } = await query;
  if (error) throw error;

  console.log(`${heroes.length} heroes to enrich${force ? ' (--force mode)' : ''}.`);

  for (let i = 0; i < heroes.length; i++) {
    const hero = heroes[i];
    console.log(`[${i + 1}/${heroes.length}] ${hero.name}...`);

    try {
      const { summary, firstIssueId } = await fetchComicVine(hero.name);
      const firstIssueImageUrl = firstIssueId ? await fetchIssueImage(firstIssueId) : null;

      const { error: updateError } = await supabase
        .from('heroes')
        .update({
          summary,
          first_issue_image_url: firstIssueImageUrl,
          comicvine_enriched_at: new Date().toISOString(),
        })
        .eq('id', hero.id);

      if (updateError) throw updateError;
      console.log(`  summary: ${summary ? 'yes' : 'none'}, issue image: ${firstIssueImageUrl ? 'yes' : 'none'}`);
    } catch (e) {
      console.error(`  FAILED: ${e instanceof Error ? e.message : e}`);
      // Continue to next hero — don't abort the whole run
    }

    if (i < heroes.length - 1) {
      console.log(`  Waiting ${DELAY_MS / 1000}s...`);
      await sleep(DELAY_MS);
    }
  }

  console.log('ComicVine enrichment complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Test with a single hero before the full run**

```bash
bun scripts/enrich-comicvine.ts --force
```

This re-enriches only heroes that already have `comicvine_enriched_at` set (i.e. your 34 seeded heroes if they were previously enriched). To test on just one hero, temporarily add `query = query.eq('name', 'Spider-Man')` before running, then revert.

Verify via `mcp__supabase__execute_sql`:
```sql
select name, summary, first_issue_image_url, comicvine_enriched_at
from heroes
where name = 'Spider-Man';
```

Expected: `summary` and `first_issue_image_url` populated.

- [ ] **Step 3: Run the full overnight enrichment**

```bash
bun scripts/enrich-comicvine.ts
```

This will take ~4 hours for 731 heroes. It's safe to close the terminal and run in a screen/tmux session, or just leave it overnight. It's fully resumable — re-running picks up where it left off.

- [ ] **Step 4: Commit**

```bash
git add scripts/enrich-comicvine.ts
git commit -m "feat(scripts): add Phase 2 ComicVine enrichment script"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `bun run test:ci` — all tests pass
- [ ] Open Search tab — no CDN network request in Metro logs, results appear from Supabase
- [ ] Search for "spider" — Spider-Man appears instantly
- [ ] Switch to Marvel filter — only Marvel heroes shown
- [ ] Open Spider-Man detail — no SuperheroAPI network request, data loads instantly
- [ ] Open a hero not in the original 34 seeded — data loads from Supabase (enriched by script)
- [ ] Verify in Supabase: `select count(*) from heroes where enriched_at is not null` → 731
