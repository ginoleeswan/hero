# This Month in History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cover-led "This Month in History" rail in the Explore Right Now band showing recognizable characters who debuted in the current calendar month, each with its vintage debut cover and anniversary, tapping through to the character.

**Architecture:** Calendar-driven, no ingestion. A `get_debuts_this_month` SQL RPC reads the debut data already in `heroes.first_issue_data` (filter: debut month = current month, `fame_score` above a floor, has a cover). A `getDebutsThisMonth` read layer maps rows and computes "years ago". A `MonthInHistoryRail` renders the covers in both `RightNowBand` views. No edge function, no `pg_cron`, no external API, no new column.

**Tech Stack:** Expo SDK 56 / React Native / expo-router 4, Supabase Postgres, expo-image, TypeScript, jest-expo.

## Global Constraints

- Package manager: **yarn** only.
- TypeScript, **no `any`** (use `unknown` for caught errors).
- Screens never import `supabase` directly — DB access via `src/lib/db/`.
- All styles via `StyleSheet.create` (no inline objects except `StyleSheet.absoluteFill` + dynamic values).
- Fonts: `Flame-Regular` (display), `FlameSans-Regular` (body), `Nunito_*` (UI). NEVER `Flame-Bold`.
- Background canvas `#f5ebdc` (`COLORS.beige`); palette from `src/constants/colors.ts`.
- Migrations: new `supabase/migrations/YYYYMMDDHHMMSS_*.sql` via MCP `apply_migration`; regenerate `src/types/database.generated.ts` via MCP after each. **Timestamps today already reach `20260628202000` — use `20260628203000`.**
- New RPCs: `grant execute … to anon, authenticated, service_role`.
- Reads degrade to `[]` so a DB hiccup never throws inside the Explore band.
- Verification: `yarn typecheck`, `yarn lint <files>`, `yarn test:ci`.

---

### Task 1: RPC — `get_debuts_this_month` (+ regenerate types)

**Files:**
- Create: `supabase/migrations/20260628203000_get_debuts_this_month.sql`
- Modify (regenerate): `src/types/database.generated.ts`

**Interfaces:**
- Produces `get_debuts_this_month(p_limit integer default 14, p_min_fame integer default 30)` returning `(id text, name text, image_url text, portrait_url text, debut_cover_url text, debut_year integer, fame_score smallint)`, ordered by `fame_score desc`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260628203000_get_debuts_this_month.sql`:

```sql
-- "This Month in History" reader: recognizable characters who debuted in the
-- current calendar month, with their debut cover. Reads the existing
-- heroes.first_issue_data JSONB (coverDate is camelCase, YYYY-MM-DD; American
-- comics are month-precision so we match by MONTH, not exact day). current_date
-- is evaluated per call, so the result rolls over on the 1st — no scheduled job.
create or replace function public.get_debuts_this_month(
  p_limit integer default 14,
  p_min_fame integer default 30
)
returns table (
  id text, name text, image_url text, portrait_url text,
  debut_cover_url text, debut_year integer, fame_score smallint
)
language sql
stable
as $$
  select
    h.id, h.name, h.image_url, h.portrait_url,
    h.first_issue_data->>'imageUrl' as debut_cover_url,
    extract(year from (h.first_issue_data->>'coverDate')::date)::integer as debut_year,
    h.fame_score
  from public.heroes h
  where h.first_issue_data->>'coverDate' ~ '^\d{4}-\d{2}-\d{2}'
    and extract(month from (h.first_issue_data->>'coverDate')::date)
        = extract(month from current_date)
    and coalesce(h.fame_score, 0) >= p_min_fame
    and (h.first_issue_data->>'imageUrl') is not null
  order by h.fame_score desc nulls last
  limit p_limit;
$$;
grant execute on function public.get_debuts_this_month(integer, integer)
  to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply + verify**

MCP `apply_migration`, name `get_debuts_this_month`, SQL above. Then MCP `execute_sql`:
```sql
select name, debut_year, fame_score from public.get_debuts_this_month(14, 30);
```
Expected (run in June 2026): fame-ranked debuts led by Superman (1938), Lois Lane, Rocket Raccoon, Poison Ivy, etc. — at least 12 rows, each with a `debut_year`.

- [ ] **Step 3: Regenerate types**

MCP `generate_typescript_types`. The result is JSON-wrapped and too large for the tool output — it is saved to a file path the tool prints. Extract the `types` field into `src/types/database.generated.ts`:
```bash
python3 -c "import json; src='<PRINTED_FILE_PATH>'; raw=open(src).read();
import sys;
data=json.loads(raw) if raw.lstrip().startswith('{') else None;
open('src/types/database.generated.ts','w').write(data['types'] if data else raw)"
```
Then confirm the new RPC is present:
```bash
grep -c "get_debuts_this_month" src/types/database.generated.ts
```
Expected: ≥ 1. (Required so the read layer's `supabase.rpc('get_debuts_this_month', …)` typechecks in Task 2.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628203000_get_debuts_this_month.sql src/types/database.generated.ts
git commit -m "feat(history): get_debuts_this_month RPC + regen types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Read layer — `getDebutsThisMonth`

**Files:**
- Create: `src/lib/db/anniversaries.ts`
- Test: `__tests__/lib/db/anniversaries.test.ts`

**Interfaces:**
- Consumes: `get_debuts_this_month` RPC (Task 1).
- Produces:
  - `interface DebutHero { id: string; name: string; image_url: string | null; portrait_url: string | null; debut_cover_url: string | null; year: number; yearsAgo: number }`
  - `getDebutsThisMonth(limit?: number): Promise<DebutHero[]>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/anniversaries.test.ts`:

```ts
import { getDebutsThisMonth } from '../../../src/lib/db/anniversaries';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('getDebutsThisMonth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC and computes yearsAgo against the current year', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'Superman',
          image_url: null,
          portrait_url: 'p.jpg',
          debut_cover_url: 'c.jpg',
          debut_year: 1938,
          fame_score: 100,
        },
      ],
      error: null,
    });
    const out = await getDebutsThisMonth(14);
    expect(supabase.rpc).toHaveBeenCalledWith('get_debuts_this_month', { p_limit: 14 });
    const currentYear = new Date().getFullYear();
    expect(out).toEqual([
      {
        id: '1',
        name: 'Superman',
        image_url: null,
        portrait_url: 'p.jpg',
        debut_cover_url: 'c.jpg',
        year: 1938,
        yearsAgo: currentYear - 1938,
      },
    ]);
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getDebutsThisMonth()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/anniversaries.test.ts`
Expected: FAIL — `getDebutsThisMonth` not exported (module not found).

- [ ] **Step 3: Implement**

Create `src/lib/db/anniversaries.ts`:

```ts
// Calendar-driven "This Month in History" reader. No external API — the data is
// already in heroes.first_issue_data; the month rollover is the only refresh.
import { supabase } from '../supabase';

export interface DebutHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** The debut issue's cover art. */
  debut_cover_url: string | null;
  /** Year the character first appeared (e.g. 1938). */
  year: number;
  /** Years since the debut, against the current calendar year (e.g. 88). */
  yearsAgo: number;
}

interface DebutRow {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  debut_cover_url: string | null;
  debut_year: number | null;
  fame_score: number | null;
}

/** Recognizable characters who debuted in the current calendar month, fame-ranked.
 *  Degrades to [] so a DB hiccup never errors the Explore band. */
export async function getDebutsThisMonth(limit = 14): Promise<DebutHero[]> {
  const { data, error } = await supabase.rpc('get_debuts_this_month', { p_limit: limit } as never);
  if (error) {
    console.warn('[getDebutsThisMonth] error:', error.message);
    return [];
  }
  const currentYear = new Date().getFullYear();
  return ((data ?? []) as unknown as DebutRow[]).map((r) => {
    const year = r.debut_year ?? currentYear;
    return {
      id: r.id,
      name: r.name,
      image_url: r.image_url,
      portrait_url: r.portrait_url,
      debut_cover_url: r.debut_cover_url,
      year,
      yearsAgo: Math.max(0, currentYear - year),
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/anniversaries.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `yarn typecheck` (expect clean).
```bash
git add src/lib/db/anniversaries.ts __tests__/lib/db/anniversaries.test.ts
git commit -m "feat(history): getDebutsThisMonth read layer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Rail `MonthInHistoryRail` + Explore wiring (native + web)

**Files:**
- Create: `src/components/home/MonthInHistoryRail.tsx`
- Modify: `src/hooks/useExploreData.ts`
- Modify: `src/components/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.tsx`
- Modify: `src/components/web/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.web.tsx`

**Interfaces:**
- Consumes: `getDebutsThisMonth`, `DebutHero` (Task 2).
- Produces: `ExploreData` + both `RightNowBandProps` gain `debuts: DebutHero[]`.

- [ ] **Step 1: Build `MonthInHistoryRail` (native; reused on web)**

Cover-led rail modeled on the sibling `ComicCoverRail` (which already renders on
both platforms). The RPC guarantees a cover, so render the cover with expo-image
directly (a debut cover is an issue cover, not a hero portrait — do **not** route
it through `HeroImage`, whose source chain is portrait-tuned). Tap → character.

Create `src/components/home/MonthInHistoryRail.tsx`:

```tsx
// src/components/home/MonthInHistoryRail.tsx — "This Month in History": the vintage
// debut covers of characters who first appeared in the current calendar month,
// each with its anniversary. Sibling of ComicCoverRail; taps open the character.
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import type { DebutHero } from '../../lib/db/anniversaries';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.min(132, Math.round(SCREEN_WIDTH * 0.34));
const CARD_H = Math.round(CARD_W * 1.5);

const MONTH = new Date().toLocaleString('en-US', { month: 'long' });

export function MonthInHistoryRail({
  debuts,
  onHeroPress,
}: {
  debuts: DebutHero[];
  onHeroPress: (id: string) => void;
}) {
  if (debuts.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.label}>This Month</Text>
        <Text style={s.title}>Debuts in {MONTH}</Text>
      </View>
      <FlatList
        horizontal
        data={debuts}
        keyExtractor={(d) => d.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        initialNumToRender={4}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => onHeroPress(item.id)}>
            {item.debut_cover_url ? (
              <Image
                source={{ uri: item.debut_cover_url }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, s.fallback]} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(11,24,32,0.92)']}
              locations={[0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.badge}>
              <Text style={s.badgeText}>{item.yearsAgo} yrs</Text>
            </View>
            <Text style={s.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={s.year}>{item.year}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 6 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  strip: { gap: 10, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  fallback: { backgroundColor: COLORS.navy },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.orange,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#fff',
  },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    lineHeight: 13,
    paddingHorizontal: 8,
  },
  year: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.6)',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 1,
  },
});
```

- [ ] **Step 2: Wire `useExploreData`**

In `src/hooks/useExploreData.ts`:
1. Add an import near the other `db` imports:
   ```ts
   import { getDebutsThisMonth, type DebutHero } from '../lib/db/anniversaries';
   ```
2. In the `ExploreData` interface, after `wikiTrending: WikiTrendingHero[];` add:
   ```ts
   debutsThisMonth: DebutHero[];
   ```
3. In `INITIAL`, after `wikiTrending: [],` add:
   ```ts
   debutsThisMonth: [],
   ```
4. In the mount `useEffect`, after the `getTrendingHeroesWiki(14)...` block add:
   ```ts
       getDebutsThisMonth(14)
         .then(set('debutsThisMonth'))
         .catch(() => {});
   ```

- [ ] **Step 3: Native `RightNowBand` + Explore**

In `src/components/home/RightNowBand.tsx`:
1. After `import { WikiTrendingRail } from './WikiTrendingRail';` add:
   ```ts
   import { MonthInHistoryRail } from './MonthInHistoryRail';
   ```
2. In the `'../../lib/db/trending'` import group, the type `WikiTrendingHero` is
   already imported; add a separate import for the debut type:
   ```ts
   import type { DebutHero } from '../../lib/db/anniversaries';
   ```
3. In `RightNowBandProps`, after `wikiTrending: WikiTrendingHero[];` add:
   ```ts
   debuts: DebutHero[];
   ```
4. In the destructure (after `wikiTrending,`) add `debuts,`.
5. In `hasAny`, add a final clause: `|| debuts.length > 0`.
6. Render directly after the `<WikiTrendingRail … />` element. The rail prop is
   `debuts`; native `onHeroPress` is item-shaped, so bridge it as
   `(id) => onHeroPress({ id })`:
   ```tsx
   <MonthInHistoryRail debuts={debuts} onHeroPress={(id) => onHeroPress({ id })} />
   ```

In `app/(tabs)/explore.tsx`:
1. Add a new import (from the new `anniversaries` module, not `trending`):
   ```ts
   import type { DebutHero } from '../../src/lib/db/anniversaries';
   ```
2. In the `FeedRow` `rightnow` variant, after `wikiTrending: WikiTrendingHero[];` add:
   ```ts
   debuts: DebutHero[];
   ```
3. In the `useExploreData()` destructure (after `wikiTrending,`) add `debutsThisMonth,`.
4. In the `rows` useMemo: add `|| debutsThisMonth.length > 0` to the `rightnow`
   condition; add `debuts: debutsThisMonth,` to the pushed object; add
   `debutsThisMonth,` to the `useMemo` dependency array.
5. In the `case 'rightnow'` render, after `wikiTrending={item.wikiTrending}` add:
   ```tsx
   debuts={item.debuts}
   ```

- [ ] **Step 4: Web `RightNowBand` + Explore**

In `src/components/web/home/RightNowBand.tsx`:
1. After `import { WikiTrendingRail } from '../../home/WikiTrendingRail';` add:
   ```ts
   import { MonthInHistoryRail } from '../../home/MonthInHistoryRail';
   import type { DebutHero } from '../../../lib/db/anniversaries';
   ```
2. In `RightNowBandProps`, after `wikiTrending: WikiTrendingHero[];` add `debuts: DebutHero[];`.
3. In the destructure (after `wikiTrending,`) add `debuts,`.
4. In `hasAny`, add `|| debuts.length > 0`.
5. Render directly after the `<WikiTrendingRail … />` element (web `onHeroPress`
   is already `(id: string) => void`, pass it through):
   ```tsx
   <MonthInHistoryRail debuts={debuts} onHeroPress={onHeroPress} />
   ```

In `app/(tabs)/explore.web.tsx`: in the `<RightNowBand …>` element, after
`wikiTrending={homeData.wikiTrending ?? []}` add:
```tsx
debuts={homeData.debutsThisMonth ?? []}
```

- [ ] **Step 5: Typecheck + lint + full test + commit**

Run:
```bash
yarn typecheck
yarn lint src/components/home/MonthInHistoryRail.tsx src/lib/db/anniversaries.ts src/hooks/useExploreData.ts src/components/home/RightNowBand.tsx "app/(tabs)/explore.tsx" src/components/web/home/RightNowBand.tsx "app/(tabs)/explore.web.tsx"
yarn test:ci
```
Expected: typecheck clean; lint reports **0 errors** (pre-existing warnings in
`explore.tsx` — unused `Pressable`/`Ionicons` — are acceptable; the gate is
errors-only); all suites pass (517 tests = prior 515 + 2 new).
```bash
git add src/components/home/MonthInHistoryRail.tsx src/lib/db/anniversaries.ts src/hooks/useExploreData.ts src/components/home/RightNowBand.tsx "app/(tabs)/explore.tsx" src/components/web/home/RightNowBand.tsx "app/(tabs)/explore.web.tsx"
git commit -m "feat(history): This Month in History rail (native + web)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: Visual handoff (user-driven)**

User verifies web from device screenshots. Hand off: "This Month in History rail
appears in the Right Now band after the Wikipedia rail — vintage debut covers of
characters who first appeared this calendar month, fame-ranked, tapping to the
character."

---

## Self-Review

**Spec coverage:**
- Month-precision matching (not exact day) → Task 1 RPC `extract(month …)`. ✓
- Reads existing `first_issue_data` (no ingestion/cron/edge fn/column) → Task 1. ✓
- Fame floor (default 30, guarantees ≥23/month) → Task 1 `p_min_fame`. ✓
- Fame ranking → Task 1 `order by fame_score desc`. ✓
- `debut_year` returned, `yearsAgo` computed live → Tasks 1 + 2. ✓
- Cover-led card, taps to character → Task 3 rail (expo-image cover, `onHeroPress`). ✓
- Eyebrow "This Month" + title "Debuts in {month}" → Task 3 header. ✓
- Caption `{year} · {yearsAgo} yrs` → Task 3 `badge` (yrs) + `year`. ✓
- Rail in both Right Now bands, after the wiki rail → Task 3 Steps 3–4. ✓
- Hidden when empty / degrade to [] → rail `length === 0` guard + read layer error path. ✓
- Existing-table RLS, RPC grant → Task 1 grant; no new table. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows full code. Task 1 Step 3's
`<PRINTED_FILE_PATH>` is the literal path the MCP types tool prints at run time —
unavoidable and clearly marked, not a vague placeholder.

**Type consistency:** `DebutHero` defined in Task 2, consumed unchanged in Task 3
(rail prop `debuts: DebutHero[]`, both bands, the hook field `debutsThisMonth:
DebutHero[]`). `getDebutsThisMonth(limit?)` signature matches Task 2 ↔ Task 3
caller. RPC columns (Task 1) map one-for-one to `DebutRow` (Task 2). The rail prop
is `debuts` (not `heroes`) at every call site. `yearsAgo = currentYear − year` is
consistent between the read-layer impl and its test.
