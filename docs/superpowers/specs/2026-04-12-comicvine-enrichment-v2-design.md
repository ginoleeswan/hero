# ComicVine Enrichment v2 — Extended Character Data

**Date:** 2026-04-12
**Scope:** Native character screen (`app/character/[id].tsx`), edge function (`supabase/functions/get-comicvine-hero/index.ts`), DB migration
**Goal:** Fetch 8 additional fields from the ComicVine detail endpoint (already called for powers) and surface them on the character screen

---

## What We're Adding

All new data comes from the **same detail endpoint** already called for `powers`. No extra API calls needed — we expand the `field_list` and stop throwing the data away.

| ComicVine field | What it is | Display |
|---|---|---|
| `origin` | Character type: Mutant / Alien / Human / God/Eternal / Cyborg / Robot / Radiation / Training | Colour-coded badge in identity block |
| `description` | Full HTML wiki-style description | Expandable "About" block below summary |
| `count_of_issue_appearances` | Integer — total issue count | Muted line below identity badges |
| `creators` | Array of `{name, role}` objects | Single credit line in identity block |
| `enemies` | Array of `{name}` objects | Red chips in new Enemies & Allies section |
| `friends` | Array of `{name}` objects | Green chips in new Enemies & Allies section |
| `movies` | Array of `{name, date}` objects | New On Screen section |
| `teams` | Array of `{name}` objects | Chips in Connections, superseding SuperheroAPI affiliation |

---

## Files to Modify

| File | What changes |
|---|---|
| `supabase/functions/get-comicvine-hero/index.ts` | Expand `field_list`, extract/process new fields, write to DB |
| `supabase/migrations/YYYYMMDDHHMMSS_comicvine_v2.sql` | 8 new columns on `heroes` table |
| `src/types/database.generated.ts` | Regenerate after migration |
| `src/types/index.ts` | Extend `HeroDetails` with 7 new nullable fields |
| `src/lib/api.ts` | Update `fetchHeroDetails` return type + null fallback initialisers |
| `src/lib/db/heroes.ts` | Map new columns in `heroRowToCharacterData` + select in `getHeroById` |
| `app/character/[id].tsx` | All UI additions |

No new components files — all additions are inline within the existing screen.

---

## Edge Function Changes

### Detail endpoint field expansion

Current `field_list`: `powers`

New `field_list`: `powers,origin,character_enemies,character_friends,creators,count_of_issue_appearances,movies,description,teams`

### Field extraction

```typescript
// origin — plain string enum
const origin: string | null = detailJson.results?.origin?.name ?? null;

// description — HTML, must be stripped
const rawDescription: string = detailJson.results?.description ?? '';
const description: string | null = rawDescription
  ? rawDescription
      .replace(/<[^>]+>/g, ' ')   // strip all HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')       // collapse whitespace
      .trim() || null
  : null;

// issue count
const issueCount: number | null = detailJson.results?.count_of_issue_appearances ?? null;

// creators — writer + artist names only
const creators: string[] = Array.isArray(detailJson.results?.creators)
  ? detailJson.results.creators
      .map((c: { name?: string }) => c.name ?? '')
      .filter((n: string) => n.length > 0)
      .slice(0, 5)
  : [];

// enemies — character names, capped at 20
const enemies: string[] = Array.isArray(detailJson.results?.character_enemies)
  ? detailJson.results.character_enemies
      .map((e: { name?: string }) => e.name ?? '')
      .filter((n: string) => n.length > 0)
      .slice(0, 20)
  : [];

// friends — character names, capped at 20
const friends: string[] = Array.isArray(detailJson.results?.character_friends)
  ? detailJson.results.character_friends
      .map((f: { name?: string }) => f.name ?? '')
      .filter((n: string) => n.length > 0)
      .slice(0, 20)
  : [];

// movies — "Title (YYYY)" strings
const movies: string[] = Array.isArray(detailJson.results?.movies)
  ? detailJson.results.movies
      .map((m: { name?: string; date?: string }) => {
        const year = m.date ? m.date.slice(0, 4) : null;
        return m.name ? (year ? `${m.name} (${year})` : m.name) : '';
      })
      .filter((s: string) => s.length > 0)
  : [];

// teams — team names, capped at 20
const teams: string[] = Array.isArray(detailJson.results?.teams)
  ? detailJson.results.teams
      .map((t: { name?: string }) => t.name ?? '')
      .filter((n: string) => n.length > 0)
      .slice(0, 20)
  : [];
```

### DB write — remove `IS NULL` filter for re-enrichment

Current write condition:
```typescript
.is('comicvine_enriched_at', null)  // ← only enriches once, blocks new columns
```

New write — always update, no condition:
```typescript
await supabase
  .from('heroes')
  .update({
    summary,
    powers,
    description: description ?? null,
    origin: origin ?? null,
    issue_count: issueCount ?? null,
    creators: creators.length > 0 ? creators : null,
    enemies: enemies.length > 0 ? enemies : null,
    friends: friends.length > 0 ? friends : null,
    movies: movies.length > 0 ? movies : null,
    cv_teams: teams.length > 0 ? teams : null,
    comicvine_enriched_at: new Date().toISOString(),
  })
  .eq('id', heroId);
```

### Response payload — add new fields

```typescript
return json({
  summary,
  publisher,
  firstIssueId,
  powers,
  description: description ?? null,
  origin: origin ?? null,
  issueCount: issueCount ?? null,
  creators: creators.length > 0 ? creators : null,
  enemies: enemies.length > 0 ? enemies : null,
  friends: friends.length > 0 ? friends : null,
  movies: movies.length > 0 ? movies : null,
  teams: teams.length > 0 ? teams : null,
});
```

---

## DB Migration

```sql
ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS issue_count integer,
  ADD COLUMN IF NOT EXISTS creators text[],
  ADD COLUMN IF NOT EXISTS enemies text[],
  ADD COLUMN IF NOT EXISTS friends text[],
  ADD COLUMN IF NOT EXISTS movies text[],
  ADD COLUMN IF NOT EXISTS cv_teams text[];
```

After applying: regenerate `src/types/database.generated.ts`.

---

## Type Changes (`src/types/index.ts`)

Extend `HeroDetails`:

```typescript
export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
  powers: string[] | null;
  // v2 additions
  description: string | null;
  origin: string | null;
  issueCount: number | null;
  creators: string[] | null;
  enemies: string[] | null;
  friends: string[] | null;
  movies: string[] | null;
  teams: string[] | null;
}
```

Update `fetchHeroDetails` return initialiser in `src/lib/api.ts` (the `return { summary: null, ... }` fallback) to include all new fields as `null`.

---

## `src/lib/db/heroes.ts` Changes

### `getHeroById` — select new columns

Add to the `.select()` call:
```
description, origin, issue_count, creators, enemies, friends, movies, cv_teams
```

### `heroRowToCharacterData` — map new fields

```typescript
details: {
  summary: hero.summary ?? null,
  publisher: null,
  firstIssueId: null,
  powers: (hero.powers as string[] | null) ?? null,
  description: hero.description ?? null,
  origin: hero.origin ?? null,
  issueCount: hero.issue_count ?? null,
  creators: (hero.creators as string[] | null) ?? null,
  enemies: (hero.enemies as string[] | null) ?? null,
  friends: (hero.friends as string[] | null) ?? null,
  movies: (hero.movies as string[] | null) ?? null,
  teams: (hero.cv_teams as string[] | null) ?? null,
},
```

### Re-enrichment trigger — client side

```typescript
// In app/character/[id].tsx:
const needsComicVine = !hero.comicvine_enriched_at || hero.powers === null || hero.origin === null;
```

---

## UI Changes (`app/character/[id].tsx`)

### Origin badge

```typescript
const ORIGIN_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  mutant:        { label: 'Mutant',    bg: 'rgba(139,92,246,0.15)',  color: '#7c3aed' },
  alien:         { label: 'Alien',     bg: 'rgba(21,161,171,0.15)',  color: COLORS.blue },
  human:         { label: 'Human',     bg: 'rgba(162,161,155,0.15)', color: COLORS.grey },
  'god/eternal': { label: 'Eternal',   bg: 'rgba(249,178,34,0.18)',  color: '#b07d00'  },
  radiation:     { label: 'Radiation', bg: 'rgba(231,115,51,0.15)',  color: COLORS.orange },
  cyborg:        { label: 'Cyborg',    bg: 'rgba(45,45,45,0.12)',    color: COLORS.black  },
  robot:         { label: 'Robot',     bg: 'rgba(45,45,45,0.12)',    color: COLORS.black  },
  training:      { label: 'Training',  bg: 'rgba(80,35,20,0.12)',    color: COLORS.brown  },
  inhuman:       { label: 'Inhuman',   bg: 'rgba(21,161,171,0.15)',  color: COLORS.blue   },
};

function OriginBadge({ origin }: { origin: string | null | undefined }) {
  if (!origin) return null;
  const config = ORIGIN_CONFIG[origin.toLowerCase().trim()];
  if (!config) return null;
  return (
    <View style={[styles.alignmentBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.alignmentBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}
```

Render `<OriginBadge>` in the `nameRowRight` alongside `<AlignmentBadge>`.

### Issue count + creator credit

Below the `nameRow`, before `nameDivider`:

```tsx
{(data.details.issueCount && data.details.issueCount > 0) || data.details.creators?.length ? (
  <View style={styles.heroMeta}>
    {data.details.issueCount && data.details.issueCount > 0 ? (
      <Text style={styles.heroMetaText}>
        Featured in {data.details.issueCount.toLocaleString()} issues
      </Text>
    ) : null}
    {data.details.creators?.length ? (
      <Text style={styles.heroMetaText}>
        Created by {data.details.creators.join(' & ')}
      </Text>
    ) : null}
  </View>
) : null}
```

New styles:
```typescript
heroMeta: { marginTop: 6, gap: 2 },
heroMetaText: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 11,
  color: COLORS.navy,
  opacity: 0.5,
},
```

### Expandable description (About block)

Below the existing `summaryBlock`. Only shown if `data.details.description` exists and is non-empty.

```tsx
function AboutBlock({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.aboutBlock}>
      <Text
        style={styles.aboutText}
        numberOfLines={expanded ? undefined : 4}
      >
        {description}
      </Text>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.aboutToggle}>{expanded ? 'Show less' : 'Read more'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

New styles:
```typescript
aboutBlock: { paddingHorizontal: 20, paddingBottom: 8 },
aboutText: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 13,
  color: COLORS.navy,
  lineHeight: 20,
  opacity: 0.8,
},
aboutToggle: {
  fontFamily: 'Flame-Regular',
  fontSize: 12,
  color: COLORS.orange,
  marginTop: 6,
},
```

### Enemies & Allies section

New `Section` between Overview (#7) and Appearance (#8):

```tsx
{(data.details.enemies?.length || data.details.friends?.length) ? (
  <Section title="Enemies & Allies">
    {data.details.enemies?.length ? (
      <CharacterChips label="Enemies" chips={data.details.enemies} chipStyle="enemy" />
    ) : null}
    {data.details.friends?.length ? (
      <CharacterChips label="Allies" chips={data.details.friends} chipStyle="ally" />
    ) : null}
  </Section>
) : null}
```

```typescript
function CharacterChips({
  label,
  chips,
  chipStyle,
}: {
  label: string;
  chips: string[];
  chipStyle: 'enemy' | 'ally';
}) {
  const visible = chips.slice(0, 8);
  const remainder = chips.length - 8;
  const isEnemy = chipStyle === 'enemy';
  return (
    <View style={styles.characterChipsBlock}>
      <Text style={styles.characterChipsLabel}>{label}</Text>
      <View style={styles.chipsWrap}>
        {visible.map((name, i) => (
          <View
            key={i}
            style={[
              styles.chip,
              isEnemy ? styles.chipEnemy : styles.chipAlly,
            ]}
          >
            <Text style={[styles.chipText, isEnemy ? styles.chipTextEnemy : styles.chipTextAlly]}>
              {name}
            </Text>
          </View>
        ))}
        {remainder > 0 && (
          <View style={[styles.chip, isEnemy ? styles.chipEnemy : styles.chipAlly]}>
            <Text style={[styles.chipText, isEnemy ? styles.chipTextEnemy : styles.chipTextAlly]}>
              +{remainder} more
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
```

New styles:
```typescript
characterChipsBlock: { marginBottom: 10 },
characterChipsLabel: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 10,
  color: COLORS.navy,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
},
chipEnemy: {
  backgroundColor: 'rgba(181,48,43,0.08)',
  borderColor: 'rgba(181,48,43,0.2)',
},
chipAlly: {
  backgroundColor: 'rgba(99,169,54,0.08)',
  borderColor: 'rgba(99,169,54,0.2)',
},
chipTextEnemy: { color: COLORS.red },
chipTextAlly:  { color: COLORS.green },
```

### On Screen section

New `Section` after Enemies & Allies, before Appearance:

```tsx
{data.details.movies?.length ? (
  <Section title="On Screen">
    {data.details.movies.map((entry, i) => {
      const match = entry.match(/^(.+?)\s*\((\d{4})\)$/);
      const title = match ? match[1] : entry;
      const year  = match ? match[2] : null;
      return (
        <View key={i} style={styles.movieRow}>
          <Text style={styles.movieIcon}>🎬</Text>
          <View style={styles.movieMeta}>
            <Text style={styles.movieTitle}>{title}</Text>
            {year ? <Text style={styles.movieYear}>{year}</Text> : null}
          </View>
        </View>
      );
    })}
  </Section>
) : null}
```

New styles:
```typescript
movieRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  marginBottom: 10,
},
movieIcon: { fontSize: 20 },
movieMeta: { flex: 1 },
movieTitle: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 13,
  color: COLORS.navy,
},
movieYear: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 11,
  color: COLORS.grey,
  marginTop: 1,
},
```

### Connections — cv_teams supersedes affiliation chips

In `AffiliationChips`, update the data source:

```tsx
<AffiliationChips
  value={
    data.details.teams?.length
      ? data.details.teams.join(', ')
      : data.stats.connections['group-affiliation']
  }
/>
```

---

## Section Order (final)

| # | Section | Change |
|---|---------|--------|
| 1 | Hero image | Unchanged |
| 2 | Identity block | + origin badge, + issue count, + creator credit |
| 3 | Summary | Unchanged (deck) |
| 3b | About | New expandable block (description) |
| 4 | Power Stats | Unchanged |
| 5 | Abilities | Unchanged |
| 6 | First Appearance | Unchanged |
| 7 | Overview | Unchanged |
| 8 | Enemies & Allies | **New** |
| 9 | On Screen | **New** |
| 10 | Appearance | Unchanged |
| 11 | Connections | cv_teams replaces affiliation when available |

---

## Out of Scope

- Tappable enemies/allies (navigating to their hero screen) — name matching across APIs is unreliable, deferred
- TV series (separate ComicVine resource from movies) — `movies` field covers both in ComicVine
- Web character screen — separate effort
- Description rendering as rich text — plain stripped text is sufficient

---

## Constraints

- HTML stripping is regex-based (server-side in Deno) — sufficient for ComicVine's output
- `creators` capped at 5 names to avoid "Created by 47 people"
- `enemies`, `friends`, `teams` capped at 20 in DB; max 8 shown with `+N more`
- All new fields nullable — heroes with no data simply don't render those sections
- Re-enrichment triggered client-side by `hero.origin === null` check; fires once then stops
