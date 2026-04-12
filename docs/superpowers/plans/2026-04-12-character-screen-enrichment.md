# Character Screen Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add alignment badge, favourite count, total power score, first issue metadata, affiliation chips, relatives list, and merge Work into Connections on the native character screen — and reorder sections for better narrative flow.

**Architecture:** All changes are confined to `app/character/[id].tsx` (JSX and styles) plus one new DB function in `src/lib/db/favourites.ts` and a type/fetch extension in `src/types/index.ts` + `src/lib/api.ts`. No new components, no new screens, no migrations.

**Tech Stack:** React Native, Expo Router, TypeScript, Supabase JS client, expo-image, react-native-circular-progress, react-native-reanimated

---

## Files Modified

| File | What changes |
|------|-------------|
| `src/lib/db/favourites.ts` | Add `getHeroFavouriteCount(heroId)` |
| `src/types/index.ts` | Extend `FirstIssue` with `name`, `coverDate`, `issueNumber` |
| `src/lib/api.ts` | Update `fetchFirstIssue` field list + parse new fields |
| `app/character/[id].tsx` | All layout changes |
| `__tests__/lib/db/favourites.test.ts` | New test file for the new function |

---

## Task 1: Add `getHeroFavouriteCount` to favourites.ts

**Files:**
- Modify: `src/lib/db/favourites.ts`
- Create: `__tests__/lib/db/favourites.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/favourites.test.ts`:

```typescript
import { getHeroFavouriteCount } from '../../../src/lib/db/favourites';

// Supabase chain mock — same pattern as heroes.test.ts.
// `mockResolveWith` must start with "mock" so babel doesn't hoist it.
// eslint-disable-next-line prefer-const
let mockResolveWith: { count: number | null; error: unknown } = { count: null, error: null };

jest.mock('../../../src/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  ['select', 'eq'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(mockResolveWith).then(resolve);
  const mockFrom = jest.fn().mockReturnValue(chain);
  return { supabase: { from: mockFrom } };
});

describe('getHeroFavouriteCount', () => {
  it('returns the favourite count for a hero', async () => {
    mockResolveWith = { count: 7, error: null };
    const result = await getHeroFavouriteCount('hero-123');
    expect(result).toBe(7);
  });

  it('returns 0 when count is null', async () => {
    mockResolveWith = { count: null, error: null };
    const result = await getHeroFavouriteCount('hero-123');
    expect(result).toBe(0);
  });

  it('throws when Supabase returns an error', async () => {
    mockResolveWith = { count: null, error: new Error('DB error') };
    await expect(getHeroFavouriteCount('hero-123')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
yarn test:ci --testPathPattern="__tests__/lib/db/favourites"
```

Expected: FAIL — `getHeroFavouriteCount` is not exported.

- [ ] **Step 3: Add `getHeroFavouriteCount` to `src/lib/db/favourites.ts`**

Append after the existing `getFavouriteCount` function:

```typescript
export async function getHeroFavouriteCount(heroId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_favourites')
    .select('id', { count: 'exact', head: true })
    .eq('hero_id', heroId);
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
yarn test:ci --testPathPattern="__tests__/lib/db/favourites"
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/favourites.ts __tests__/lib/db/favourites.test.ts
git commit -m "feat(db): add getHeroFavouriteCount for per-hero favourite counts"
```

---

## Task 2: Extend `FirstIssue` type + update `fetchFirstIssue`

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Extend `FirstIssue` in `src/types/index.ts`**

Find this interface:

```typescript
export interface FirstIssue {
  id: string;
  imageUrl: string | null;
}
```

Replace with:

```typescript
export interface FirstIssue {
  id: string;
  imageUrl: string | null;
  name: string | null;
  coverDate: string | null;
  issueNumber: string | null;
}
```

- [ ] **Step 2: Update `fetchFirstIssue` in `src/lib/api.ts`**

Find `fetchFirstIssue` (currently around line 112). Replace the entire function:

```typescript
export async function fetchFirstIssue(issueId: string): Promise<FirstIssue> {
  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    field_list: 'id,image,name,cover_date,issue_number',
  });

  const res = await fetch(`${COMICVINE_BASE}/issue/4000-${issueId}/?${params}`);
  if (!res.ok) throw new Error(`ComicVine issue error: ${res.status}`);
  const json = await res.json();
  const result = json.results;

  return {
    id: issueId,
    imageUrl: result?.image?.medium_url ?? null,
    name: result?.name ?? null,
    coverDate: result?.cover_date ?? null,
    issueNumber: result?.issue_number ?? null,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
yarn tsc --noEmit
```

Expected: No errors (the new optional fields are backwards-compatible — existing callers spread or ignore them).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/api.ts
git commit -m "feat(api): extend FirstIssue with name, coverDate, issueNumber"
```

---

## Task 3: Alignment badge in the identity block

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add `AlignmentBadge` component and styles**

In `app/character/[id].tsx`, add this function after the `InfoRow` component (around line 79):

```typescript
const ALIGNMENT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  good: { label: 'Hero', bg: 'rgba(39,174,96,0.15)', color: COLORS.green },
  bad: { label: 'Villain', bg: 'rgba(231,76,60,0.15)', color: COLORS.red },
  neutral: { label: 'Neutral', bg: 'rgba(100,100,100,0.12)', color: COLORS.grey },
};

function AlignmentBadge({ alignment }: { alignment: string | null | undefined }) {
  if (!alignment) return null;
  const config = ALIGNMENT_CONFIG[alignment.toLowerCase().trim()];
  if (!config) return null;
  return (
    <View style={[styles.alignmentBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.alignmentBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}
```

Add these styles to `StyleSheet.create` at the bottom of the file:

```typescript
alignmentBadge: {
  paddingHorizontal: 10,
  paddingVertical: 3,
  borderRadius: 20,
},
alignmentBadgeText: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 11,
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
},
nameRowRight: {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
},
```

- [ ] **Step 2: Add badge to the identity block and remove alignment from Overview**

In the identity block JSX (the `data` branch of the nameRow, around line 381), find:

```tsx
<View style={styles.nameRow}>
  {data.stats.biography['full-name'] ? (
    <Text style={styles.heroAlias}>{data.stats.biography['full-name']}</Text>
  ) : null}
  <Text style={styles.heroPublisher}>{data.stats.biography.publisher}</Text>
</View>
```

Replace with:

```tsx
<View style={styles.nameRow}>
  {data.stats.biography['full-name'] ? (
    <Text style={styles.heroAlias}>{data.stats.biography['full-name']}</Text>
  ) : null}
  <View style={styles.nameRowRight}>
    <AlignmentBadge alignment={data.stats.biography.alignment} />
    <Text style={styles.heroPublisher}>{data.stats.biography.publisher}</Text>
  </View>
</View>
```

In the Overview Section (around line 436), remove the alignment InfoRow:

```tsx
// DELETE this line:
<InfoRow label="Alignment" value={data.stats.biography.alignment} />
```

- [ ] **Step 3: Start the dev server and visually verify**

```bash
yarn start
```

Open the app on iOS simulator or device. Navigate to any character. Confirm:
- A coloured badge ("Hero", "Villain", or "Neutral") appears in the name row next to the publisher
- The Overview section no longer has an Alignment row
- Characters with unknown/null alignment show no badge

- [ ] **Step 4: Commit**

```bash
git add app/character/\[id\].tsx
git commit -m "feat(character): add alignment badge to identity block"
```

---

## Task 4: Favourite count on the header heart button

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add `favCount` state and fetch it on mount**

In `CharacterScreen`, find where the other state declarations are (around line 96). Add:

```typescript
const [favCount, setFavCount] = useState<number>(0);
```

Add the import for `getHeroFavouriteCount` at the top of the file where other db imports are:

```typescript
import { isFavourited, addFavourite, removeFavourite, getHeroFavouriteCount } from '../../src/lib/db/favourites';
```

Add a new `useEffect` after the existing `isFavourited` effect:

```typescript
useEffect(() => {
  if (!id) return;
  getHeroFavouriteCount(id)
    .then(setFavCount)
    .catch(() => {});
}, [id]);
```

- [ ] **Step 2: Display the count below the heart icon**

In the `Stack.Screen` options, find the `headerRight` render function. Replace the inner `TouchableOpacity` content:

```tsx
headerRight: user
  ? () => (
      <TouchableOpacity
        onPress={toggleFavourite}
        disabled={favLoading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.headerBtn}
      >
        <Ionicons
          name={favourited ? 'heart' : 'heart-outline'}
          size={20}
          color={favourited ? COLORS.red : undefined}
        />
        {favCount > 0 ? (
          <Text style={styles.favCount}>{favCount > 999 ? '999+' : favCount}</Text>
        ) : null}
      </TouchableOpacity>
    )
  : undefined,
```

Find the existing `headerBtn` style in `StyleSheet.create` and replace it, then add the new `favCount` style:

```typescript
headerBtn: {
  width: 36,
  alignItems: 'center',
  justifyContent: 'center',
},
favCount: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 9,
  color: COLORS.grey,
  textAlign: 'center',
  lineHeight: 10,
},
```

- [ ] **Step 3: Visually verify**

Navigate to a character. Confirm:
- The count appears below the heart icon when > 0
- Favourite/unfavourite still works (count doesn't auto-update after toggle — that's fine, it's a load-time snapshot)
- Count is hidden when 0

- [ ] **Step 4: Commit**

```bash
git add app/character/\[id\].tsx
git commit -m "feat(character): show per-hero favourite count below heart button"
```

---

## Task 5: Total power score below stat dials

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add total score below the stat dials**

In the Power Stats Section (around line 417), find the closing of `<View style={styles.statsGrid}>`:

```tsx
<Section title="Power Stats">
  <View style={styles.statsGrid}>
    {STAT_CONFIG.map(({ key, label, tint }) => (
      <StatDial
        key={key}
        label={label}
        value={(data.stats.powerstats as Record<string, string>)[key] ?? '0'}
        tint={tint}
      />
    ))}
  </View>
</Section>
```

Replace with:

```tsx
<Section title="Power Stats">
  <View style={styles.statsGrid}>
    {STAT_CONFIG.map(({ key, label, tint }) => (
      <StatDial
        key={key}
        label={label}
        value={(data.stats.powerstats as Record<string, string>)[key] ?? '0'}
        tint={tint}
      />
    ))}
  </View>
  {(() => {
    const values = STAT_CONFIG.map(({ key }) =>
      parseInt((data.stats.powerstats as Record<string, string>)[key] ?? '0', 10),
    ).filter((n) => !isNaN(n) && n > 0);
    if (values.length === 0) return null;
    const total = values.reduce((sum, n) => sum + n, 0);
    return <Text style={styles.statTotal}>Total {total} / 600</Text>;
  })()}
</Section>
```

Add to `StyleSheet.create`:

```typescript
statTotal: {
  fontFamily: 'Flame-Regular',
  fontSize: 12,
  color: COLORS.navy,
  opacity: 0.45,
  textAlign: 'right',
  marginTop: 6,
},
```

- [ ] **Step 2: Visually verify**

Navigate to a character with full stats (e.g. Spider-Man). Confirm "Total 442 / 600" (or equivalent) appears right-aligned below the dials. Navigate to a character with no stats — confirm no total line appears.

- [ ] **Step 3: Commit**

```bash
git add app/character/\[id\].tsx
git commit -m "feat(character): add total power score below stat dials"
```

---

## Task 6: Move First Appearance before Overview + show issue metadata

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Relocate the First Appearance block**

In the main `<>` fragment inside the data branch (around line 400), the current order is:

```
Summary
Power Stats
AbilitiesSection
Overview
First Appearance   ← currently here
Appearance
Work
Connections
```

Cut the entire First Appearance block:

```tsx
{/* First issue */}
{data.firstIssue?.imageUrl ? (
  <Section title="First Appearance">
    <View style={styles.comicContainer}>
      <Image
        source={{ uri: data.firstIssue.imageUrl }}
        contentFit="contain"
        style={styles.comicImage}
        cachePolicy="memory-disk"
        recyclingKey={`comic-${id}`}
        transition={200}
      />
    </View>
  </Section>
) : null}
```

And paste it **before** the Overview Section with the metadata additions:

```tsx
{/* First Appearance — moved before Overview */}
{data.firstIssue?.imageUrl ? (
  <Section title="First Appearance">
    <View style={styles.comicContainer}>
      <Image
        source={{ uri: data.firstIssue.imageUrl }}
        contentFit="contain"
        style={styles.comicImage}
        cachePolicy="memory-disk"
        recyclingKey={`comic-${id}`}
        transition={200}
      />
    </View>
    {data.firstIssue.name ? (
      <Text style={styles.comicTitle}>{data.firstIssue.name}</Text>
    ) : null}
    {data.firstIssue.coverDate ? (
      <Text style={styles.comicYear}>
        {new Date(data.firstIssue.coverDate).getFullYear()}
      </Text>
    ) : null}
  </Section>
) : null}
```

- [ ] **Step 2: Add `comicTitle` and `comicYear` styles**

Add to `StyleSheet.create`:

```typescript
comicTitle: {
  fontFamily: 'Flame-Regular',
  fontSize: 13,
  color: COLORS.navy,
  textAlign: 'center',
  marginTop: 10,
},
comicYear: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 11,
  color: COLORS.grey,
  textAlign: 'center',
  marginTop: 3,
},
```

- [ ] **Step 3: Visually verify**

Navigate to a character with a first issue (e.g. Spider-Man). Confirm:
- First Appearance section appears between Abilities and Overview (not between Overview and Appearance)
- Issue name appears below the cover art
- Year appears below the name
- Characters without a first issue: section is absent with no empty gap

- [ ] **Step 4: Commit**

```bash
git add app/character/\[id\].tsx
git commit -m "feat(character): move First Appearance before Overview, add issue title and year"
```

---

## Task 7: Affiliation chips in Connections

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add `AffiliationChips` component**

Add after `AlignmentBadge` (around line 95):

```typescript
function AffiliationChips({ value }: { value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  const chips = value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s !== 'null' && s !== 'none');
  if (chips.length === 0) return null;
  const visible = chips.slice(0, 8);
  const remainder = chips.length - 8;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>Affiliations:</Text>
      <View style={styles.chipsWrap}>
        {visible.map((chip, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ))}
        {remainder > 0 && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>+{remainder} more</Text>
          </View>
        )}
      </View>
    </View>
  );
}
```

Add to `StyleSheet.create`:

```typescript
chipsWrap: {
  flex: 1,
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 5,
  justifyContent: 'flex-end',
},
chip: {
  backgroundColor: 'rgba(42,45,90,0.07)',
  borderRadius: 16,
  paddingHorizontal: 9,
  paddingVertical: 3,
},
chipText: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 11,
  color: COLORS.navy,
},
```

- [ ] **Step 2: Replace the group-affiliation InfoRow with `AffiliationChips`**

In the Connections Section, find:

```tsx
<Section title="Connections">
  <InfoRow
    label="Group affiliation"
    value={data.stats.connections['group-affiliation']}
  />
  <InfoRow label="Relatives" value={data.stats.connections.relatives} />
</Section>
```

Replace the `InfoRow` for `group-affiliation` only:

```tsx
<Section title="Connections">
  <AffiliationChips value={data.stats.connections['group-affiliation']} />
  <InfoRow label="Relatives" value={data.stats.connections.relatives} />
</Section>
```

(Relatives gets its own treatment in Task 8.)

- [ ] **Step 3: Visually verify**

Navigate to a character with affiliations (e.g. Spider-Man — "Avengers, S.H.I.E.L.D."). Confirm chips render in a wrapping row. Navigate to a character with no affiliations — confirm no empty row.

- [ ] **Step 4: Commit**

```bash
git add app/character/\[id\].tsx
git commit -m "feat(character): show affiliation chips instead of text blob in Connections"
```

---

## Task 8: Relatives as a structured list

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add `RelativesList` component**

Add after `AffiliationChips`:

```typescript
function RelativesList({ value }: { value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  const entries = value
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s !== 'null');
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    return <InfoRow label="Relatives" value={entries[0]} />;
  }
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { alignSelf: 'flex-start', paddingTop: 1 }]}>
        Relatives:
      </Text>
      <View style={{ flex: 1 }}>
        {entries.map((entry, i) => (
          <Text
            key={i}
            style={[styles.infoValue, i < entries.length - 1 && { marginBottom: 5 }]}
          >
            {entry}
          </Text>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Replace the relatives InfoRow with `RelativesList`**

In the Connections Section, find:

```tsx
<InfoRow label="Relatives" value={data.stats.connections.relatives} />
```

Replace with:

```tsx
<RelativesList value={data.stats.connections.relatives} />
```

- [ ] **Step 3: Visually verify**

Navigate to Spider-Man (relatives include multiple semicolon-separated entries). Confirm each relative appears on its own line. Navigate to a character with one relative — confirm it renders as a single row, same as before.

- [ ] **Step 4: Commit**

```bash
git add app/character/\[id\].tsx
git commit -m "feat(character): show relatives as a structured list in Connections"
```

---

## Task 9: Merge Work into Connections, remove Work section

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Move Work rows into Connections and remove the Work Section**

Find the Connections Section (now containing `AffiliationChips` + `RelativesList`). Update it to include the occupation and base rows at the top, then remove the standalone Work Section:

Replace:

```tsx
{/* Work */}
<Section title="Work">
  <InfoRow label="Occupation" value={data.stats.work.occupation} />
  <InfoRow label="Base" value={data.stats.work.base} />
</Section>

{/* Connections */}
<Section title="Connections">
  <AffiliationChips value={data.stats.connections['group-affiliation']} />
  <RelativesList value={data.stats.connections.relatives} />
</Section>
```

With:

```tsx
{/* Connections (includes work) */}
<Section title="Connections">
  <InfoRow label="Occupation" value={data.stats.work.occupation} />
  <InfoRow label="Base" value={data.stats.work.base} />
  <AffiliationChips value={data.stats.connections['group-affiliation']} />
  <RelativesList value={data.stats.connections.relatives} />
</Section>
```

- [ ] **Step 2: Visually verify the final section order**

Navigate to a character with data across all sections. Scroll through the full screen and confirm this order:

1. Hero image (parallax)
2. Name block (name · alias · alignment badge · publisher)
3. Summary text
4. Power Stats dials + "Total X / 600"
5. Abilities chips
6. First Appearance (cover + title + year) — only if data present
7. Overview (full name, place of birth, first appearance string, aliases)
8. Appearance (gender, race, height, weight, eyes, hair)
9. Connections (occupation, base, affiliation chips, relatives list)
10. Compare strip (fixed bottom)

- [ ] **Step 3: Run the full test suite**

```bash
yarn test:ci
```

Expected: All tests pass. (UI changes don't have direct tests — the new DB function test from Task 1 should pass.)

- [ ] **Step 4: Final commit**

```bash
git add app/character/\[id\].tsx
git commit -m "feat(character): merge Work into Connections section, complete enrichment"
```
