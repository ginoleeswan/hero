# Smarter Search Phase 3 (Teams) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make teams searchable across web + native, and add a `/team/[id]` roster browse page as the destination.

**Architecture:** The normalized `teams` table already exists. Part 1 adds the destination — `getTeamById`/`getTeamMembers` → a platform-neutral `useTeamPage(id)` hook → thin `/team/[id]` views. Part 2 adds `searchTeams` and folds it into `useUnifiedSearch` as a Teams section across all search surfaces.

**Tech Stack:** TypeScript, React Native (Expo, web + native), expo-router, Supabase/PostgREST, jest-expo.

**Depends on:** Phases 1 & 2 (shipped) — `useUnifiedSearch`, `NavItem`, the web/native `UniverseChip`/`TitleResultRow` pattern.

## Global Constraints

- yarn only; tests `yarn test:ci`, typecheck `yarn typecheck`, lint `yarn lint` (errors-only gate).
- No `any`; `unknown` for caught errors. Functional components. `StyleSheet.create`.
- DB access via `src/lib/db/` only. PostgREST 1000-row cap → always `.limit()`.
- Fonts: `Flame-Regular` (display) / `FlameSans-Regular` / `Nunito_*` (UI). Never `Flame-Bold`.
- Web search components under `src/components/web/search/`; native under `src/components/search/`.
- Routes with a web variant need BOTH `[id].tsx` and `[id].web.tsx` or expo-router throws.
- `teams` columns (verified): `id` text, `name` text, `publisher` text, `logo_url` text, `member_count` int, `popularity` bigint, `is_featured` bool.
- Members via existing `getTeamRoster(teamId, limit)` → `RosterHero[]` (`{id, name, portrait_url, image_url, ...stats}`) from `src/lib/db/teams.ts`.
- Section order in search: Universes → Teams → Heroes → Films & Shows. Caps: palette 3, web results 6, native 3.

---

## Part 1 — Team browse page (the destination)

### Task 1: `getTeamById` + `searchTeams` + types in `src/lib/db/teams.ts`

**Files:**
- Modify: `src/lib/db/teams.ts` (add exports)
- Test: `__tests__/lib/db/teams.test.ts` (create)

**Interfaces:**
- Produces:
  - `interface TeamSummary { id: string; name: string; publisher: string | null; logo_url: string | null; member_count: number }`
  - `type TeamSearchResult = TeamSummary`
  - `function getTeamById(id: string): Promise<TeamSummary | null>`
  - `function searchTeams(query: string, limit?: number): Promise<TeamSearchResult[]>`
  - `function getTeamMembers(id: string, limit?: number): Promise<RosterHero[]>` (thin wrapper over `getTeamRoster`)

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/db/teams.test.ts
import { searchTeams, getTeamById } from '../../../src/lib/db/teams';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

function mockSearch(rows: unknown, error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data: rows, error });
  const order = jest.fn(() => ({ limit }));
  const ilike = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ ilike }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, ilike, order, limit };
}

function mockSingle(row: unknown, error: unknown = null) {
  const single = jest.fn().mockResolvedValue({ data: row, error });
  const eq = jest.fn(() => ({ single }));
  const select = jest.fn(() => ({ eq }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, eq, single };
}

describe('searchTeams', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] for an empty query without hitting the DB', async () => {
    mockSearch([]);
    expect(await searchTeams('  ')).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries teams by ILIKE on name, ordered by popularity', async () => {
    const m = mockSearch([
      { id: 't1', name: 'Avengers', publisher: 'Marvel', logo_url: null, member_count: 145 },
    ]);
    const out = await searchTeams('aveng', 6);
    expect(supabase.from).toHaveBeenCalledWith('teams');
    expect(m.ilike).toHaveBeenCalledWith('name', '%aveng%');
    expect(m.limit).toHaveBeenCalledWith(6);
    expect(out[0]).toEqual({
      id: 't1',
      name: 'Avengers',
      publisher: 'Marvel',
      logo_url: null,
      member_count: 145,
    });
  });

  it('degrades to [] on error', async () => {
    mockSearch(null, { message: 'boom' });
    expect(await searchTeams('x')).toEqual([]);
  });
});

describe('getTeamById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps a row to a TeamSummary', async () => {
    mockSingle({ id: 't1', name: 'X-Men', publisher: 'Marvel', logo_url: null, member_count: 284 });
    const t = await getTeamById('t1');
    expect(t?.name).toBe('X-Men');
    expect(t?.member_count).toBe(284);
  });

  it('returns null when missing', async () => {
    mockSingle(null, { code: 'PGRST116' });
    expect(await getTeamById('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/teams.test.ts`
Expected: FAIL — `searchTeams`/`getTeamById` not exported.

- [ ] **Step 3: Add the implementation to `src/lib/db/teams.ts`**

Append (the file already imports `supabase` and `RosterHero`):

```ts
export interface TeamSummary {
  id: string;
  name: string;
  publisher: string | null;
  logo_url: string | null;
  member_count: number;
}

export type TeamSearchResult = TeamSummary;

const TEAM_SUMMARY_COLS = 'id, name, publisher, logo_url, member_count';

/**
 * Team search for the unified search surface. ILIKE on name, ranked by
 * popularity (Avengers/X-Men/JLA float up). Empty query short-circuits; degrades
 * to [] so a DB hiccup never blanks the other result sections.
 */
export async function searchTeams(query: string, limit = 6): Promise<TeamSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SUMMARY_COLS)
    .ilike('name', `%${q}%`)
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.warn('[searchTeams] error:', error.message);
    return [];
  }
  return (data ?? []) as TeamSearchResult[];
}

/** One team's summary for the /team/[id] page header. null when not found. */
export async function getTeamById(id: string): Promise<TeamSummary | null> {
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SUMMARY_COLS)
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.warn('[getTeamById] error:', error.message);
  }
  return (data as TeamSummary | null) ?? null;
}

/** A team's full member roster for the browse page (one fetch — teams are small). */
export async function getTeamMembers(id: string, limit = 300): Promise<RosterHero[]> {
  return getTeamRoster(id, limit);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/teams.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/teams.ts __tests__/lib/db/teams.test.ts
git commit -m "feat(teams): searchTeams + getTeamById + getTeamMembers"
```

---

### Task 2: `useTeamPage(id)` hook

**Files:**
- Create: `src/hooks/useTeamPage.ts`
- Test: `__tests__/hooks/useTeamPage.test.tsx`

**Interfaces:**
- Consumes: `getTeamById`, `getTeamMembers`, `TeamSummary` (Task 1); `RosterHero` from `src/lib/teamBattle`.
- Produces: `function useTeamPage(id: string | undefined): { team: TeamSummary | null; members: RosterHero[]; loading: boolean; notFound: boolean }`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/hooks/useTeamPage.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { useTeamPage } from '../../src/hooks/useTeamPage';
import { getTeamById, getTeamMembers } from '../../src/lib/db/teams';

jest.mock('../../src/lib/db/teams', () => ({
  getTeamById: jest.fn(),
  getTeamMembers: jest.fn(),
}));

const mockById = getTeamById as jest.MockedFunction<typeof getTeamById>;
const mockMembers = getTeamMembers as jest.MockedFunction<typeof getTeamMembers>;

describe('useTeamPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves team + members', async () => {
    mockById.mockResolvedValue({ id: 't1', name: 'Avengers', publisher: 'Marvel', logo_url: null, member_count: 2 });
    mockMembers.mockResolvedValue([{ id: 'h1', name: 'Iron Man' }] as never);
    const { result } = renderHook(() => useTeamPage('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.team?.name).toBe('Avengers');
    expect(result.current.members).toHaveLength(1);
    expect(result.current.notFound).toBe(false);
  });

  it('flags notFound when the team is missing', async () => {
    mockById.mockResolvedValue(null);
    mockMembers.mockResolvedValue([]);
    const { result } = renderHook(() => useTeamPage('nope'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notFound).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/hooks/useTeamPage.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useTeamPage.ts
import { useEffect, useState } from 'react';
import { getTeamById, getTeamMembers, type TeamSummary } from '../lib/db/teams';
import type { RosterHero } from '../lib/teamBattle';

export interface TeamPage {
  team: TeamSummary | null;
  members: RosterHero[];
  loading: boolean;
  notFound: boolean;
}

// Platform-neutral data for the /team/[id] browse page: the team summary (header)
// + its full member roster (grid), fetched in parallel. Shared by the native and
// web views so they can't drift.
export function useTeamPage(id: string | undefined): TeamPage {
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [members, setMembers] = useState<RosterHero[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getTeamById(id), getTeamMembers(id, 300)])
      .then(([t, m]) => {
        if (cancelled) return;
        setTeam(t);
        setMembers(m);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { team, members, loading, notFound: !loading && team === null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/hooks/useTeamPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTeamPage.ts __tests__/hooks/useTeamPage.test.tsx
git commit -m "feat(teams): useTeamPage hook"
```

---

### Task 3: `/team/[id]` route — native + web views

**Files:**
- Create: `app/team/[id].tsx` (native)
- Create: `app/team/[id].web.tsx` (web)

**Interfaces:**
- Consumes: `useTeamPage` (Task 2). Routes to `/character/[id]`.
- Produces: the route. No exports consumed by later tasks.

No unit tests (route view files, per CLAUDE.md). Verified by typecheck + manual.

- [ ] **Step 1: Write the native view**

```tsx
// app/team/[id].tsx — native team roster browse page.
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeamPage } from '../../src/hooks/useTeamPage';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const GAP = 8;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { team, members, loading, notFound } = useTeamPage(id);

  const headerHeight = insets.top + 44;
  const eyebrow = team
    ? `${team.member_count.toLocaleString()} ${team.member_count === 1 ? 'MEMBER' : 'MEMBERS'}${team.publisher ? ` · ${team.publisher.toUpperCase()}` : ''}`
    : '';

  const listHeader = (
    <>
      <View style={[styles.stage, { paddingTop: headerHeight + 16 }]}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.stageTitle} numberOfLines={2}>
          {team?.name ?? (notFound ? 'Team not found' : '')}
        </Text>
      </View>
      <View style={styles.sheetTop} />
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />
      {loading ? (
        <View style={[styles.center, { paddingTop: headerHeight + 80 }]}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={members}
          keyExtractor={(h) => String(h.id)}
          numColumns={NUM_COLUMNS}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/character/${item.id}`);
              }}
            >
              <HeroImage
                id={item.id}
                name={item.name}
                imageUrl={item.image_url}
                portraitUrl={item.portrait_url}
                contentFit="cover"
                contentPosition="top"
                style={StyleSheet.absoluteFill}
                recyclingKey={String(item.id)}
                transition={150}
              />
              <LinearGradient
                colors={['transparent', 'rgba(29,45,51,0.88)']}
                locations={[0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.cardName} numberOfLines={2}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>{notFound ? 'This team doesn’t exist.' : 'No members found'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  list: { flex: 1, backgroundColor: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: H_PAD, paddingBottom: 28 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  stageTitle: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.beige, lineHeight: 36 },
  sheetTop: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    marginTop: -16,
    height: 30,
  },
  row: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    padding: 6,
  },
  cardName: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige, lineHeight: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
});
```

- [ ] **Step 2: Write the web view**

```tsx
// app/team/[id].web.tsx — web team roster browse page.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTeamPage } from '../../src/hooks/useTeamPage';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, SURFACE, SURFACE_GRADIENT, SEAM_COLOR } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { SeoHead } from '../../src/components/web/SeoHead';

export default function WebTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { team, members, loading, notFound } = useTeamPage(id);
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  const eyebrow = team
    ? `${team.member_count.toLocaleString()} ${team.member_count === 1 ? 'member' : 'members'}${team.publisher ? ` · ${team.publisher}` : ''}`
    : '';

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 12,
  };

  return (
    <View style={styles.root}>
      <SeoHead
        title={team ? `${team.name} — team | Mythique` : 'Team | Mythique'}
        description={team ? `The members of ${team.name}.` : 'Team roster on Mythique.'}
        path={`/team/${id}`}
        noindex
      />
      <View style={styles.stage as object}>
        <View style={styles.stageInner}>
          <Text style={styles.eyebrow as object}>{eyebrow}</Text>
          <Text style={styles.title as object} numberOfLines={2}>
            {team?.name ?? (notFound ? 'Team not found' : ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.body as object}>
        {loading ? null : members.length === 0 ? (
          <Text style={styles.empty as object}>
            {notFound ? 'This team doesn’t exist.' : 'No members found.'}
          </Text>
        ) : (
          <View style={gridStyle as object}>
            {members.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => router.push(`/character/${h.id}`)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [styles.card, hovered && (styles.cardHover as object)] as object
                }
              >
                <HeroImage
                  id={h.id}
                  name={h.name}
                  imageUrl={h.image_url}
                  portraitUrl={h.portrait_url}
                  grid
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={StyleSheet.absoluteFill}
                  recyclingKey={h.id}
                  transition={150}
                />
                <View style={styles.cardOverlay as object} />
                <Text style={styles.cardName as object} numberOfLines={2}>
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  stage: {
    backgroundColor: COLORS.navy,
    backgroundImage: SURFACE_GRADIENT.stage,
    paddingTop: TOPBAR_HEIGHT + 40,
    paddingBottom: 28,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    boxShadow: '0 14px 30px -14px rgba(11,24,32,0.55)',
  } as object,
  stageInner: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  } as object,
  title: { fontFamily: 'Flame-Regular', fontSize: 40, color: COLORS.beige, lineHeight: 44 } as object,
  body: { maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey, paddingTop: 40 } as object,
  card: {
    width: '100%',
    aspectRatio: '3 / 4',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  cardHover: { transform: [{ scale: 1.04 }], boxShadow: '0 20px 56px rgba(0,0,0,0.32)', zIndex: 2 } as object,
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  cardName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});
```

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: PASS. (If `SURFACE`/`SURFACE_GRADIENT`/`SEAM_COLOR`/`TOPBAR_HEIGHT`/`useScreenChrome`/`SeoHead` import names differ, fix to match — they are the same ones used by `app/(tabs)/search/index.web.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add "app/team/[id].tsx" "app/team/[id].web.tsx"
git commit -m "feat(teams): /team/[id] roster browse page (native + web)"
```

---

## Part 2 — Team search

### Task 4: Add teams to `useUnifiedSearch`

**Files:**
- Modify: `src/hooks/useUnifiedSearch.ts`
- Modify: `__tests__/hooks/useUnifiedSearch.test.tsx`

**Interfaces:**
- Consumes: `searchTeams`, `TeamSearchResult` (Task 1).
- Produces (extended return): `{ universes, teams, heroes, titles, loading, resultCount }`.

- [ ] **Step 1: Add the failing test case**

Add the mock + case to `__tests__/hooks/useUnifiedSearch.test.tsx`:

```tsx
import { searchTeams } from '../../src/lib/db/teams';
jest.mock('../../src/lib/db/teams', () => ({ searchTeams: jest.fn() }));
const mockSearchTeams = searchTeams as jest.MockedFunction<typeof searchTeams>;
```

Add `mockSearchTeams.mockResolvedValue([]);` to the existing `beforeEach`, then:

```tsx
it('populates the teams section', async () => {
  mockUseHeroSearch.mockReturnValue({ results: [], loading: false, hasCriteria: true });
  mockSearchTeams.mockResolvedValue([
    { id: 't1', name: 'Avengers', publisher: 'Marvel', logo_url: null, member_count: 145 },
  ]);
  const { result } = renderHook(() => useUnifiedSearch('avengers'));
  await waitFor(() => expect(result.current.teams).toHaveLength(1));
  expect(result.current.teams[0].name).toBe('Avengers');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test:ci __tests__/hooks/useUnifiedSearch.test.tsx`
Expected: FAIL — `result.current.teams` undefined.

- [ ] **Step 3: Extend the hook**

In `src/hooks/useUnifiedSearch.ts`: import `searchTeams, type TeamSearchResult`; add `teams` to the interface; add a debounced effect mirroring `titles`. Full new file:

```ts
import { useEffect, useMemo, useState } from 'react';
import { searchUniverses, type UniverseResult } from '../lib/db/universes';
import { searchTeams, type TeamSearchResult } from '../lib/db/teams';
import { searchTitles, type TitleSearchResult } from '../lib/db/titles';
import { useHeroSearch } from './useHeroSearch';
import type { HeroSearchResult } from '../lib/db/heroes';

export interface UnifiedSearch {
  universes: UniverseResult[];
  teams: TeamSearchResult[];
  heroes: HeroSearchResult[];
  titles: TitleSearchResult[];
  loading: boolean;
  resultCount: number;
}

function useDebouncedQuery<T>(
  trimmed: string,
  fetcher: (q: string) => Promise<T[]>,
  limit: number,
): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    if (!trimmed) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await fetcher(trimmed, limit as never);
      if (!cancelled) setItems(res);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, fetcher, limit]);
  return items;
}

// Grouped search across types. Universes resolve synchronously from the registry;
// heroes ride the existing debounced RPC; teams + titles are debounced queries.
// Section order (consumer): universes, teams, heroes, titles.
export function useUnifiedSearch(query: string, heroLimit = 100): UnifiedSearch {
  const trimmed = query.trim();
  const universes = useMemo(() => searchUniverses(trimmed, 3), [trimmed]);
  const { results: heroes, loading } = useHeroSearch(query, 'All', heroLimit);
  const teams = useDebouncedQuery(trimmed, searchTeams, 6);
  const titles = useDebouncedQuery(trimmed, searchTitles, 6);
  return { universes, teams, heroes, titles, loading, resultCount: heroes.length };
}
```

Note: `useDebouncedQuery` DRYs the teams + titles effects. `searchTeams`/
`searchTitles` are stable module functions, so they're safe in the dep array.

- [ ] **Step 4: Run to verify all pass**

Run: `yarn test:ci __tests__/hooks/useUnifiedSearch.test.tsx`
Expected: PASS (all cases, including the prior titles case).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUnifiedSearch.ts __tests__/hooks/useUnifiedSearch.test.tsx
git commit -m "feat(teams): teams in useUnifiedSearch (DRY debounced queries)"
```

---

### Task 5: Web `TeamResultRow` component

**Files:**
- Create: `src/components/web/search/TeamResultRow.tsx`

**Interfaces:**
- Consumes: `TeamSearchResult` (Task 1), `COLORS`.
- Produces: `function TeamResultRow({ team, onPress, variant, active }): JSX.Element` where `variant?: 'dark'|'light'`, `active?: boolean`.

No unit test (component render). Typecheck-verified.

- [ ] **Step 1: Write the component**

```tsx
// src/components/web/search/TeamResultRow.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { TeamSearchResult } from '../../../lib/db/teams';

// A team search-hit row: monogram tile + name + "N members · publisher", a
// doorway into /team/[id]. Teams have no logo art yet, so the tile shows the
// team's initials. Dark variant = palette panel; light = beige results page.
export function TeamResultRow({
  team,
  onPress,
  variant = 'dark',
  active = false,
}: {
  team: TeamSearchResult;
  onPress: () => void;
  variant?: 'dark' | 'light';
  active?: boolean;
}) {
  const light = variant === 'light';
  const meta = [
    `${team.member_count} member${team.member_count === 1 ? '' : 's'}`,
    team.publisher,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`Browse the ${team.name} team`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [styles.row, (hovered || active) && ((light ? styles.rowHoverLight : styles.rowHover) as object)] as object
      }
    >
      <View style={styles.tile as object}>
        <Text style={styles.monogram as object} numberOfLines={1}>
          {team.name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, light && (styles.nameLight as object)] as object} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={[styles.meta, light && (styles.metaLight as object)] as object} numberOfLines={1}>
          {meta}
        </Text>
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
  rowHoverLight: { backgroundColor: 'rgba(29,45,51,0.06)' } as object,
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.35)',
  } as object,
  monogram: { fontFamily: 'Flame-Regular', fontSize: 14, color: COLORS.orange } as object,
  text: { flexDirection: 'column', flexShrink: 1 },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige } as object,
  nameLight: { color: COLORS.navy } as object,
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  } as object,
  metaLight: { color: 'rgba(29,45,51,0.5)' } as object,
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `yarn typecheck`
Expected: PASS.

```bash
git add src/components/web/search/TeamResultRow.tsx
git commit -m "feat(teams): web TeamResultRow component"
```

---

### Task 6: Teams section in the palette + keyboard nav

**Files:**
- Modify: `src/components/web/search/SearchDropdownContent.tsx`
- Modify: `src/components/web/search/SearchPalette.tsx`

- [ ] **Step 1: Render the Teams section and wire nav**

In `SearchDropdownContent.tsx`:
- Import `TeamResultRow`.
- Extend the `NavItem` union and add a `MAX_TEAM_SUGGESTIONS = 3`:

```tsx
export type NavItem =
  | { kind: 'universe'; slug: string }
  | { kind: 'team'; id: string }
  | { kind: 'hero'; id: string }
  | { kind: 'title'; id: string };

const MAX_TEAM_SUGGESTIONS = 3;
```

- Destructure `teams` from `useUnifiedSearch`; compute `shownTeams = teams.slice(0, MAX_TEAM_SUGGESTIONS)`.
- Insert teams into the flat `navItems` (after universes, before heroes):

```tsx
  const navItems: NavItem[] = isEmptyQuery
    ? []
    : [
        ...universes.map((u) => ({ kind: 'universe', slug: u.slug }) as NavItem),
        ...shownTeams.map((t) => ({ kind: 'team', id: t.id }) as NavItem),
        ...shownHeroes.map((h) => ({ kind: 'hero', id: h.id }) as NavItem),
        ...shownTitles.map((t) => ({ kind: 'title', id: t.id }) as NavItem),
      ];
```

- Derive `activeTeamId`:

```tsx
  const activeTeamId = activeItem?.kind === 'team' ? activeItem.id : undefined;
```

- Add a handler:

```tsx
  const handleTeamPress = (tid: string) => {
    addSearch(query);
    close();
    router.push(`/team/${tid}` as Parameters<typeof router.push>[0]);
  };
```

- Render the section inside `scroll`, between the Universes section and `<SuggestionsList>`:

```tsx
        {shownTeams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel as object}>Teams</Text>
            {shownTeams.map((t) => (
              <TeamResultRow
                key={t.id}
                team={t}
                active={t.id === activeTeamId}
                onPress={() => handleTeamPress(t.id)}
              />
            ))}
          </View>
        )}
```

In `SearchPalette.tsx`, add a `team` branch to the Enter handler (before the `else`/hero branch):

```tsx
        } else if (item.kind === 'team') {
          router.push(`/team/${item.id}` as Parameters<typeof router.push>[0]);
```

- [ ] **Step 2: Typecheck + full suite**

Run: `yarn typecheck && yarn test:ci`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/web/search/SearchDropdownContent.tsx src/components/web/search/SearchPalette.tsx
git commit -m "feat(teams): Teams section + keyboard nav in palette"
```

---

### Task 7: Teams section on the web results page

**Files:**
- Modify: `app/(tabs)/search/index.web.tsx`

- [ ] **Step 1: Render the Teams section above the hero grid, below Universes**

Destructure `teams` from `useUnifiedSearch`; import `TeamResultRow`. After the
universes section block (and before `<View style={gridStyle}>`), insert:

```tsx
          {teams.length > 0 && (
            <View style={styles.titlesSection}>
              <Text style={styles.idleLabel as object}>Teams</Text>
              {teams.map((t) => (
                <View key={t.id} style={styles.universeChipWrap as object}>
                  <TeamResultRow
                    team={t}
                    variant="light"
                    onPress={() => router.push(`/team/${t.id}` as Parameters<typeof router.push>[0])}
                  />
                </View>
              ))}
            </View>
          )}
```

Add `import { TeamResultRow } from '../../../src/components/web/search/TeamResultRow';`.

- [ ] **Step 2: Typecheck + full suite**

Run: `yarn typecheck && yarn test:ci`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/search/index.web.tsx"
git commit -m "feat(teams): Teams section on web results page"
```

---

### Task 8: Native `TeamResultRow` + Teams section on native search

**Files:**
- Create: `src/components/search/TeamResultRow.tsx`
- Modify: `app/(tabs)/search/index.tsx`

- [ ] **Step 1: Write the native component**

```tsx
// src/components/search/TeamResultRow.tsx — native team search-hit row.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import type { TeamSearchResult } from '../../lib/db/teams';

export function TeamResultRow({
  team,
  onPress,
}: {
  team: TeamSearchResult;
  onPress: () => void;
}) {
  const meta = [
    `${team.member_count} member${team.member_count === 1 ? '' : 's'}`,
    team.publisher,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressScale onPress={onPress} style={styles.row}>
      <View style={styles.tile}>
        <Text style={styles.monogram} numberOfLines={1}>
          {team.name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(245,235,220,0.35)" />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.35)',
  },
  monogram: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.orange },
  text: { flex: 1, flexDirection: 'column' },
  name: { fontFamily: 'Flame-Regular', fontSize: 17, color: COLORS.beige },
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
```

- [ ] **Step 2: Wire it into native search**

In `app/(tabs)/search/index.tsx`:
- Import: `import { TeamResultRow } from '../../../src/components/search/TeamResultRow';` and `import { searchTeams, type TeamSearchResult } from '../../../src/lib/db/teams';`
- Add a debounced teams fetch mirroring the titles one:

```tsx
  const [teams, setTeams] = useState<TeamSearchResult[]>([]);
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setTeams([]);
      return;
    }
    let cancelled = false;
    searchTeams(q, 3)
      .then((res) => {
        if (!cancelled) setTeams(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);
```

- In `listHeader`, insert a Teams section between the Universes section and the Films & Shows section:

```tsx
      {!isIdle && teams.length > 0 && (
        <View style={styles.universeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Teams</Text>
          </View>
          {teams.map((t) => (
            <TeamResultRow
              key={t.id}
              team={t}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/team/${t.id}` as Parameters<typeof router.push>[0]);
              }}
            />
          ))}
        </View>
      )}
```

- [ ] **Step 3: Typecheck + full suite + lint**

Run: `yarn typecheck && yarn test:ci && yarn lint`
Expected: typecheck PASS, tests PASS, lint 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/search/TeamResultRow.tsx "app/(tabs)/search/index.tsx"
git commit -m "feat(teams): native TeamResultRow + Teams section on native search"
```

---

## Self-Review

- **Spec coverage:** `searchTeams`/`getTeamById`/`getTeamMembers` (Task 1) ✓; `useTeamPage` (Task 2) ✓; `/team/[id]` native+web (Task 3) ✓; teams in `useUnifiedSearch` (Task 4) ✓; web `TeamResultRow` (Task 5) ✓; palette section + keyboard nav, order Universes→Teams→Heroes→Titles (Task 6) ✓; web results page section (Task 7) ✓; native row + section (Task 8) ✓. Caps 3/6/3 honoured. Popularity-order, no filter ✓.
- **Type consistency:** `TeamSummary`/`TeamSearchResult` (same shape) used identically across Tasks 1–8; `RosterHero` reused from `src/lib/teamBattle`; `NavItem` extended once (Task 6) and matched in the palette branch. `useTeamPage` return type matches both view consumers.
- **Placeholder scan:** none — all steps carry real code.
- **Risk note:** Task 3 web view assumes `SURFACE`/`SURFACE_GRADIENT`/`SEAM_COLOR`/`TOPBAR_HEIGHT`/`useScreenChrome`/`SeoHead` export names (copied from `search/index.web.tsx`); Step 3 says to reconcile if any differ.
