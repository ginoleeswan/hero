# Abilities Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a hero's named powers (from ComicVine) as glowing gradient orbs with bold filled icons on the character detail screen.

**Architecture:** Add a `powers text[]` column to the heroes table (DB-first with live ComicVine fallback), extend the existing `fetchHeroDetails` + `heroRowToCharacterData` pipeline to carry powers through `CharacterData`, and render them in a new `AbilitiesSection` component slotted between Power Stats and Overview on the character screen.

**Tech Stack:** Supabase (migration + MCP tools), ComicVine REST API, React Native (ScrollView, LinearGradient, Ionicons), expo-linear-gradient, @expo/vector-icons/Ionicons, jest-expo + @testing-library/react-native

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260412120000_add_hero_powers.sql` | Create | Add `powers text[]` column |
| `src/types/database.generated.ts` | Regenerate | Reflect new column (never edit by hand) |
| `src/types/index.ts` | Modify | Add `powers` to `HeroDetails` interface |
| `src/lib/api.ts` | Modify | Fetch + parse powers from ComicVine |
| `src/lib/db/heroes.ts` | Modify | Map `hero.powers` in `heroRowToCharacterData` |
| `src/constants/powerIcons.ts` | Create | Power name → icon/gradient map + `getPowerIcon()` |
| `src/components/AbilitiesSection.tsx` | Create | Orb row UI with expand/collapse |
| `app/character/[id].tsx` | Modify | Mount `<AbilitiesSection>` between Power Stats and Overview |
| `__tests__/constants/powerIcons.test.ts` | Create | Unit tests for `getPowerIcon` |
| `__tests__/lib/api.test.ts` | Modify | Add powers parsing test to existing file (or create) |
| `__tests__/lib/db/heroes.test.ts` | Modify | Add powers mapping test |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260412120000_add_hero_powers.sql`

- [ ] **Step 1.1: Create the migration file**

```sql
-- supabase/migrations/20260412120000_add_hero_powers.sql
ALTER TABLE heroes ADD COLUMN powers text[] NULL;
```

- [ ] **Step 1.2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool:
```
name: "add_hero_powers"
query: "ALTER TABLE heroes ADD COLUMN powers text[] NULL;"
```

Expected: migration applied successfully with no errors.

- [ ] **Step 1.3: Regenerate TypeScript types**

Use the `mcp__supabase__generate_typescript_types` MCP tool and write the output to `src/types/database.generated.ts`.

Verify the `heroes` Row type now contains:
```ts
powers: string[] | null
```

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260412120000_add_hero_powers.sql src/types/database.generated.ts
git commit -m "feat(db): add powers column to heroes table"
```

---

## Task 2: Extend TypeScript Types + Data Mapping

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/db/heroes.ts`
- Create: `__tests__/lib/db/heroes.test.ts` (or modify if it exists)

- [ ] **Step 2.1: Write the failing test for `heroRowToCharacterData` powers mapping**

Check if `__tests__/lib/db/heroes.test.ts` exists. If not, create it. Add this test:

```ts
// __tests__/lib/db/heroes.test.ts
import { heroRowToCharacterData } from '../../src/lib/db/heroes';
import type { Tables } from '../../src/types/database.generated';

type Hero = Tables<'heroes'>;

const baseHero: Hero = {
  id: '1',
  name: 'Test Hero',
  powers: null,
  intelligence: 80,
  strength: 90,
  speed: 70,
  durability: 85,
  power: 75,
  combat: 80,
  full_name: 'Test T. Hero',
  alter_egos: null,
  aliases: [],
  place_of_birth: null,
  first_appearance: null,
  publisher: 'Marvel',
  alignment: 'good',
  gender: 'Male',
  race: 'Human',
  height_imperial: "6'2\"",
  height_metric: '188 cm',
  weight_imperial: '200 lb',
  weight_metric: '91 kg',
  eye_color: 'Blue',
  hair_color: 'Black',
  occupation: 'Hero',
  base: 'New York',
  group_affiliation: null,
  relatives: null,
  summary: null,
  image_url: null,
  image_md_url: null,
  portrait_url: null,
  first_issue_image_url: null,
  category: null,
  enriched_at: null,
  comicvine_enriched_at: null,
};

describe('heroRowToCharacterData', () => {
  it('maps powers array to details.powers', () => {
    const hero: Hero = { ...baseHero, powers: ['Flight', 'Super Strength'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.powers).toEqual(['Flight', 'Super Strength']);
  });

  it('maps null powers to null', () => {
    const hero: Hero = { ...baseHero, powers: null };
    const result = heroRowToCharacterData(hero);
    expect(result.details.powers).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run the test to confirm it fails**

```bash
yarn test:ci --testPathPattern="heroes.test"
```

Expected: FAIL — `details.powers` is `undefined` or the property doesn't exist on `HeroDetails`.

- [ ] **Step 2.3: Add `powers` to the `HeroDetails` interface**

In `src/types/index.ts`, update `HeroDetails`:

```ts
export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
  powers: string[] | null;
}
```

- [ ] **Step 2.4: Map `hero.powers` in `heroRowToCharacterData`**

In `src/lib/db/heroes.ts`, find `heroRowToCharacterData` and update the `details` object:

```ts
details: {
  summary: hero.summary ?? null,
  publisher: hero.publisher ?? null,
  firstIssueId: null,
  powers: hero.powers ?? null,      // ← add this line
},
```

- [ ] **Step 2.5: Fix any TypeScript errors caused by the new `powers` field**

The `fetchHeroDetails` function in `src/lib/api.ts` returns `HeroDetails` but doesn't yet include `powers`. Add a temporary `powers: null` return value so it compiles:

```ts
// In fetchHeroDetails, update all return statements:
return { summary: null, publisher: null, firstIssueId: null, powers: null };
// and:
return {
  summary: result.deck ?? null,
  publisher: result.publisher?.name ?? null,
  firstIssueId: ...,
  powers: null,   // ← temporary — Task 3 will fill this in
};
```

Also update the fallback object in the `data` state initialisation in `app/character/[id].tsx`:

```ts
details: { summary: null, publisher: null, firstIssueId: null, powers: null },
```

- [ ] **Step 2.6: Run the test to confirm it passes**

```bash
yarn test:ci --testPathPattern="heroes.test"
```

Expected: PASS

- [ ] **Step 2.7: Commit**

```bash
git add src/types/index.ts src/lib/db/heroes.ts app/character/[id].tsx __tests__/lib/db/heroes.test.ts
git commit -m "feat(types): add powers to HeroDetails and heroRowToCharacterData"
```

---

## Task 3: Fetch Powers from ComicVine

**Files:**
- Modify: `src/lib/api.ts`
- Create/Modify: `__tests__/lib/api.test.ts`

- [ ] **Step 3.1: Write the failing test**

Check if `__tests__/lib/api.test.ts` exists. If not, create it. Add this test:

```ts
// __tests__/lib/api.test.ts
import { fetchHeroDetails } from '../../src/lib/api';

// Mock expo-constants to avoid native module errors
jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { superheroApiKey: 'test', comicvineApiKey: 'test' } } },
}));

// Mock react-native Platform to simulate native (iOS)
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('fetchHeroDetails', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('parses powers array from ComicVine response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            deck: 'A hero of great power.',
            publisher: { name: 'Marvel' },
            first_appeared_in_issue: null,
            powers: [{ name: 'Flight' }, { name: 'Super Strength' }, { name: 'Telepathy' }],
          },
        ],
      }),
    });

    const result = await fetchHeroDetails('Spider-Man');
    expect(result.powers).toEqual(['Flight', 'Super Strength', 'Telepathy']);
  });

  it('returns null powers when ComicVine returns no powers array', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            deck: null,
            publisher: null,
            first_appeared_in_issue: null,
            powers: null,
          },
        ],
      }),
    });

    const result = await fetchHeroDetails('Unknown Hero');
    expect(result.powers).toBeNull();
  });

  it('returns null powers when no results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await fetchHeroDetails('Nobody');
    expect(result.powers).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run the test to confirm it fails**

```bash
yarn test:ci --testPathPattern="api.test"
```

Expected: FAIL — `result.powers` is `null` even when ComicVine returns powers data.

- [ ] **Step 3.3: Update `fetchHeroDetails` to fetch and parse powers**

In `src/lib/api.ts`, update the `fetchHeroDetails` function:

```ts
export async function fetchHeroDetails(heroName: string): Promise<HeroDetails> {
  if (Platform.OS === 'web') return { summary: null, publisher: null, firstIssueId: null, powers: null };

  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    filter: `name:${heroName}`,
    field_list: 'deck,publisher,first_appeared_in_issue,powers',   // ← add powers
    limit: '1',
  });

  const res = await fetch(`${COMICVINE_BASE}/characters/?${params}`);
  if (!res.ok) throw new Error(`ComicVine error: ${res.status}`);
  const json = await res.json();
  const result = json.results?.[0];

  if (!result) return { summary: null, publisher: null, firstIssueId: null, powers: null };

  const powers: string[] | null = Array.isArray(result.powers) && result.powers.length > 0
    ? result.powers.map((p: { name: string }) => p.name)
    : null;

  return {
    summary: result.deck ?? null,
    publisher: result.publisher?.name ?? null,
    firstIssueId: result.first_appeared_in_issue?.id
      ? String(result.first_appeared_in_issue.id)
      : null,
    powers,
  };
}
```

- [ ] **Step 3.4: Run the test to confirm it passes**

```bash
yarn test:ci --testPathPattern="api.test"
```

Expected: PASS (all 3 tests)

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/api.ts __tests__/lib/api.test.ts
git commit -m "feat(api): fetch and parse powers from ComicVine"
```

---

## Task 4: Power Icons Map

**Files:**
- Create: `src/constants/powerIcons.ts`
- Create: `__tests__/constants/powerIcons.test.ts`

- [ ] **Step 4.1: Write the failing tests**

```ts
// __tests__/constants/powerIcons.test.ts
import { getPowerIcon, POWER_ICON_FALLBACK } from '../../src/constants/powerIcons';

describe('getPowerIcon', () => {
  it('matches exact lowercase power name', () => {
    expect(getPowerIcon('flight').icon).toBe('airplane');
  });

  it('matches case-insensitively', () => {
    expect(getPowerIcon('FLIGHT').icon).toBe('airplane');
    expect(getPowerIcon('Flight').icon).toBe('airplane');
  });

  it('matches substring — "Enhanced Strength" hits the strength entry', () => {
    expect(getPowerIcon('Enhanced Strength').icon).toBe('barbell');
  });

  it('matches substring — "Super Speed" hits the speed entry', () => {
    expect(getPowerIcon('Super Speed').icon).toBe('flash');
  });

  it('returns fallback for an unknown power', () => {
    expect(getPowerIcon('Cheese Manipulation')).toEqual(POWER_ICON_FALLBACK);
  });

  it('fallback icon is "star"', () => {
    expect(POWER_ICON_FALLBACK.icon).toBe('star');
  });
});
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
yarn test:ci --testPathPattern="powerIcons.test"
```

Expected: FAIL — module not found.

- [ ] **Step 4.3: Create `src/constants/powerIcons.ts`**

```ts
// src/constants/powerIcons.ts
import { COLORS } from './colors';

export interface PowerIconDef {
  icon: string;
  gradientStart: string;
  gradientEnd: string;
}

/**
 * Substring-keyed map of power name fragments → icon + gradient.
 * Keys are lowercase. Matching is case-insensitive substring.
 * Order matters — more specific keys should come before broader ones.
 */
export const POWER_ICONS: Record<string, PowerIconDef> = {
  // Physical
  'strength':        { icon: 'barbell',          gradientStart: '#ff8a8a', gradientEnd: '#c0392b' },
  'flight':          { icon: 'airplane',          gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },
  'fly':             { icon: 'airplane',          gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },
  'speed':           { icon: 'flash',             gradientStart: '#fde68a', gradientEnd: '#d97706' },
  'agility':         { icon: 'walk',              gradientStart: '#fde68a', gradientEnd: '#b45309' },
  'reflexes':        { icon: 'flash',             gradientStart: '#fde68a', gradientEnd: '#d97706' },
  'stamina':         { icon: 'fitness',           gradientStart: '#6ee7b7', gradientEnd: '#047857' },
  'claws':           { icon: 'paw',              gradientStart: '#d1a97f', gradientEnd: '#78350f' },
  'beast':           { icon: 'paw',              gradientStart: '#d1a97f', gradientEnd: '#78350f' },
  'animal':          { icon: 'paw',              gradientStart: '#d1a97f', gradientEnd: '#78350f' },

  // Defensive
  'invulner':        { icon: 'shield-checkmark', gradientStart: '#6ee7b7', gradientEnd: '#047857' },
  'durability':      { icon: 'shield',           gradientStart: '#6ee7b7', gradientEnd: '#047857' },
  'force field':     { icon: 'shield',           gradientStart: '#6ee7b7', gradientEnd: '#065f46' },
  'healing':         { icon: 'medkit',           gradientStart: '#86efac', gradientEnd: '#15803d' },
  'regenerat':       { icon: 'medkit',           gradientStart: '#86efac', gradientEnd: '#15803d' },
  'immortal':        { icon: 'infinite',         gradientStart: '#a5b4fc', gradientEnd: '#3730a3' },

  // Mental
  'telepathy':       { icon: 'pulse',            gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  'telekinesis':     { icon: 'planet',           gradientStart: '#c4b5fd', gradientEnd: '#6d28d9' },
  'mind control':    { icon: 'pulse',            gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  'precognit':       { icon: 'eye',              gradientStart: '#c4b5fd', gradientEnd: '#6d28d9' },
  'intelligence':    { icon: 'library',          gradientStart: '#93c5fd', gradientEnd: '#1e40af' },
  'genius':          { icon: 'library',          gradientStart: '#93c5fd', gradientEnd: '#1e40af' },
  'empathy':         { icon: 'heart',            gradientStart: '#fda4af', gradientEnd: '#be123c' },
  'emotion':         { icon: 'heart',            gradientStart: '#fda4af', gradientEnd: '#be123c' },
  'soul':            { icon: 'heart',            gradientStart: '#fda4af', gradientEnd: '#be123c' },

  // Energy
  'heat vision':     { icon: 'eye',              gradientStart: '#fed7aa', gradientEnd: '#c2410c' },
  'laser':           { icon: 'eye',              gradientStart: '#fed7aa', gradientEnd: '#c2410c' },
  'energy':          { icon: 'nuclear',          gradientStart: '#fde68a', gradientEnd: '#ca8a04' },
  'radiation':       { icon: 'nuclear',          gradientStart: '#d9f99d', gradientEnd: '#4d7c0f' },
  'fire':            { icon: 'flame',            gradientStart: '#fed7aa', gradientEnd: '#ea580c' },
  'ice':             { icon: 'snow',             gradientStart: '#e0f2fe', gradientEnd: '#0284c7' },
  'freeze':          { icon: 'snow',             gradientStart: '#e0f2fe', gradientEnd: '#0284c7' },
  'cold':            { icon: 'snow',             gradientStart: '#e0f2fe', gradientEnd: '#0284c7' },
  'electric':        { icon: 'flash',            gradientStart: '#fef08a', gradientEnd: '#ca8a04' },
  'lightning':       { icon: 'thunderstorm',     gradientStart: '#fef08a', gradientEnd: '#a16207' },
  'storm':           { icon: 'thunderstorm',     gradientStart: '#bae6fd', gradientEnd: '#0369a1' },
  'weather':         { icon: 'thunderstorm',     gradientStart: '#bae6fd', gradientEnd: '#0369a1' },
  'wind':            { icon: 'wind',             gradientStart: '#bae6fd', gradientEnd: '#0369a1' },
  'magnetic':        { icon: 'magnet',           gradientStart: '#fca5a5', gradientEnd: '#dc2626' },
  'gravity':         { icon: 'planet',           gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  'cosmic':          { icon: 'planet',           gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  'sonic':           { icon: 'radio',            gradientStart: '#fde68a', gradientEnd: '#d97706' },

  // Transformation
  'shape':           { icon: 'refresh',          gradientStart: '#99f6e4', gradientEnd: '#0f766e' },
  'transform':       { icon: 'refresh',          gradientStart: '#99f6e4', gradientEnd: '#0f766e' },
  'size':            { icon: 'resize',           gradientStart: '#fde68a', gradientEnd: '#b45309' },
  'giant':           { icon: 'resize',           gradientStart: '#fde68a', gradientEnd: '#b45309' },
  'shrink':          { icon: 'resize',           gradientStart: '#fde68a', gradientEnd: '#b45309' },
  'intangib':        { icon: 'water',            gradientStart: '#bae6fd', gradientEnd: '#0369a1' },

  // Sensory
  'x-ray':           { icon: 'scan',             gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  'sense':           { icon: 'scan',             gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  'sonar':           { icon: 'radio',            gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },

  // Mobility
  'teleport':        { icon: 'swap-horizontal',  gradientStart: '#c4b5fd', gradientEnd: '#7c3aed' },
  'invisib':         { icon: 'eye-off',          gradientStart: '#cbd5e1', gradientEnd: '#475569' },
  'stealth':         { icon: 'eye-off',          gradientStart: '#cbd5e1', gradientEnd: '#475569' },
  'underwater':      { icon: 'water',            gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },
  'aquatic':         { icon: 'water',            gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },

  // Misc
  'time':            { icon: 'hourglass',        gradientStart: '#a5b4fc', gradientEnd: '#3730a3' },
  'magic':           { icon: 'color-wand',       gradientStart: '#fde68a', gradientEnd: '#d97706' },
  'sorcery':         { icon: 'color-wand',       gradientStart: '#fde68a', gradientEnd: '#d97706' },
  'web':             { icon: 'git-network',      gradientStart: '#d1a97f', gradientEnd: '#78350f' },
  'symbiote':        { icon: 'bug',              gradientStart: '#cbd5e1', gradientEnd: '#1e293b' },
  'technopathy':     { icon: 'hardware-chip',    gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  'cyber':           { icon: 'hardware-chip',    gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  'plant':           { icon: 'leaf',             gradientStart: '#bbf7d0', gradientEnd: '#15803d' },
  'nature':          { icon: 'leaf',             gradientStart: '#bbf7d0', gradientEnd: '#15803d' },
  'dark':            { icon: 'moon',             gradientStart: '#cbd5e1', gradientEnd: '#1e293b' },
  'shadow':          { icon: 'moon',             gradientStart: '#cbd5e1', gradientEnd: '#334155' },
  'light':           { icon: 'sunny',            gradientStart: '#fef08a', gradientEnd: '#ca8a04' },
  'illumin':         { icon: 'sunny',            gradientStart: '#fef08a', gradientEnd: '#ca8a04' },
};

export const POWER_ICON_FALLBACK: PowerIconDef = {
  icon: 'star',
  gradientStart: '#fed7aa',
  gradientEnd: '#ea580c',
};

/**
 * Returns the icon definition for a given ComicVine power name.
 * Case-insensitive substring match. First match wins.
 * Falls back to POWER_ICON_FALLBACK for unmapped powers.
 */
export function getPowerIcon(powerName: string): PowerIconDef {
  const lower = powerName.toLowerCase();
  for (const [key, def] of Object.entries(POWER_ICONS)) {
    if (lower.includes(key)) return def;
  }
  return POWER_ICON_FALLBACK;
}
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
yarn test:ci --testPathPattern="powerIcons.test"
```

Expected: PASS (all 6 tests)

- [ ] **Step 4.5: Commit**

```bash
git add src/constants/powerIcons.ts __tests__/constants/powerIcons.test.ts
git commit -m "feat(constants): add power icons map and getPowerIcon matcher"
```

---

## Task 5: AbilitiesSection Component

**Files:**
- Create: `src/components/AbilitiesSection.tsx`

- [ ] **Step 5.1: Create the component**

```tsx
// src/components/AbilitiesSection.tsx
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { getPowerIcon } from '../constants/powerIcons';
import { Skeleton } from './ui/Skeleton';
import { SkeletonProvider } from './ui/SkeletonProvider';

const COLLAPSED_COUNT = 8;
const ORB_SIZE = 64;
const ITEM_WIDTH = 76;

interface Props {
  powers: string[] | null;
  loading: boolean;
}

function PowerOrb({ name }: { name: string }) {
  const { icon, gradientStart, gradientEnd } = getPowerIcon(name);
  return (
    <View style={styles.orbItem}>
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.orb}
      >
        <Ionicons name={icon as any} size={26} color="white" style={styles.orbIcon} />
      </LinearGradient>
      <Text style={styles.orbName} numberOfLines={2}>{name}</Text>
    </View>
  );
}

function MoreOrb({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.orbItem}>
      <View style={[styles.orb, styles.moreOrb]}>
        <Text style={styles.moreOrbText}>+{count}</Text>
      </View>
      <Text style={styles.orbName}>more</Text>
    </TouchableOpacity>
  );
}

export function AbilitiesSection({ powers, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!loading && (!powers || powers.length === 0)) return null;

  const overflow = powers ? Math.max(0, powers.length - COLLAPSED_COUNT) : 0;
  const visible = powers ? (expanded ? powers : powers.slice(0, COLLAPSED_COUNT)) : [];

  return (
    <View style={styles.container}>
      {/* Section header — matches the app's existing Section pattern */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Abilities</Text>
        <View style={styles.divider} />
      </View>

      {loading ? (
        <SkeletonProvider>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.orbItem}>
                <Skeleton width={ORB_SIZE} height={ORB_SIZE} borderRadius={ORB_SIZE / 2} />
                <Skeleton width={52} height={10} borderRadius={4} style={{ marginTop: 6 }} />
              </View>
            ))}
          </ScrollView>
        </SkeletonProvider>
      ) : expanded ? (
        <>
          <View style={styles.expandedGrid}>
            {visible.map((name) => (
              <PowerOrb key={name} name={name} />
            ))}
          </View>
          <TouchableOpacity onPress={() => setExpanded(false)} style={styles.showLess}>
            <Text style={styles.showLessText}>Show less</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {visible.map((name) => (
            <PowerOrb key={name} name={name} />
          ))}
          {overflow > 0 && (
            <MoreOrb count={overflow} onPress={() => setExpanded(true)} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 4,
  },

  // Section header — mirrors the app's existing Section component style
  sectionHeader: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 30,
    marginBottom: 14,
  },

  // Scroll view — padding goes on contentContainerStyle, NOT style, to avoid clipping
  scrollView: {},
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Orb item
  orbItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    gap: 6,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  orbIcon: {
    // drop-shadow via shadow props on the orb itself
  },
  orbName: {
    fontFamily: 'Flame-Regular',
    fontSize: 9,
    color: COLORS.navy,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 12,
  },

  // "+N more" orb
  moreOrb: {
    backgroundColor: COLORS.navy,
  },
  moreOrbText: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
  },

  // Expanded grid
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },

  // Show less
  showLess: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  showLessText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    textDecorationLine: 'underline',
  },
});
```

- [ ] **Step 5.2: Verify TypeScript compiles**

```bash
yarn expo export --platform ios --dev 2>&1 | head -30
```

Expected: No TypeScript errors related to `AbilitiesSection.tsx`. (Build may fail for unrelated reasons — only TypeScript errors matter here.)

Alternatively, run the type-checker directly if available:
```bash
npx tsc --noEmit 2>&1 | grep "AbilitiesSection"
```

Expected: No output (no errors in that file).

- [ ] **Step 5.3: Commit**

```bash
git add src/components/AbilitiesSection.tsx
git commit -m "feat(components): add AbilitiesSection orb row with expand/collapse"
```

---

## Task 6: Wire into Character Screen

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 6.1: Import `AbilitiesSection`**

At the top of `app/character/[id].tsx`, add the import alongside the other component imports:

```ts
import { AbilitiesSection } from '../../src/components/AbilitiesSection';
```

- [ ] **Step 6.2: Mount the component between Power Stats and Overview**

Inside the `<>...</>` block (the `data` truthy branch), find the Power Stats section and the Overview section:

```tsx
{/* Power Stats — circular dials, 3×2 grid */}
<Section title="Power Stats">
  ...
</Section>

{/* ← Insert here */}
<AbilitiesSection
  powers={data.details.powers}
  loading={comicVineLoading}
/>

{/* Overview */}
<Section title="Overview">
  ...
</Section>
```

- [ ] **Step 6.3: Run all tests to confirm nothing is broken**

```bash
yarn test:ci
```

Expected: All tests pass. No regressions.

- [ ] **Step 6.4: Start the dev server and manually verify on a device or simulator**

```bash
yarn start
```

Open the app on iOS simulator, navigate to any character that is enriched (e.g. Superman, Spider-Man). Verify:
1. While ComicVine is loading — 4 skeleton orbs appear in the Abilities section
2. After load — gradient orbs with icons and power names appear
3. If the hero has > 8 powers — a navy "+N more" orb appears at position 9
4. Tapping "+N more" — expands to a wrapped grid showing all powers
5. Tapping "Show less" — collapses back to the scroll row
6. If the hero has no powers data — the Abilities section is absent entirely

- [ ] **Step 6.5: Commit**

```bash
git add app/character/[id].tsx
git commit -m "feat(character): add AbilitiesSection between Power Stats and Overview"
```

---

## Done

All tasks complete. The abilities section is live — powers fetched from ComicVine, cached in Supabase for enriched heroes, rendered as gradient orbs with bold filled icons on the character screen.
