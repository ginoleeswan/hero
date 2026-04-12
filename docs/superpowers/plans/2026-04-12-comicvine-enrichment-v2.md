# ComicVine Enrichment v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch 8 additional fields from the ComicVine character detail endpoint (already called for powers) and surface them as new UI sections and identity block enhancements on the native character screen.

**Architecture:** The edge function `get-comicvine-hero` already calls the ComicVine detail endpoint for `powers` — we expand its `field_list` to fetch origin, enemies, friends, creators, issue count, movies, description, and teams. New columns are added to the `heroes` DB table, the TypeScript types are extended, and the character screen renders the data in new and enhanced sections.

**Tech Stack:** Deno edge function (Supabase), PostgreSQL migration via Supabase MCP, React Native / Expo SDK 55, TypeScript, Jest + @testing-library/react-native, expo-router v4.

---

## File Map

| File | Role |
|---|---|
| `supabase/migrations/20260412130000_comicvine_v2.sql` | Create — 8 new nullable columns on `heroes` |
| `src/types/database.generated.ts` | Regenerate after migration (never hand-edit) |
| `src/types/index.ts` | Extend `HeroDetails` with 8 new nullable fields |
| `src/lib/api.ts` | Update `fetchHeroDetails` invoke type + return + null fallback |
| `src/lib/db/heroes.ts` | Map new columns in `heroRowToCharacterData` |
| `supabase/functions/get-comicvine-hero/index.ts` | Expand field_list, extract new fields, update DB write |
| `__tests__/lib/db/heroes.test.ts` | Add new `heroRowToCharacterData` tests + update `baseHero` fixture |
| `app/character/[id].tsx` | All UI: origin badge, issue count, creators, About block, Enemies & Allies, On Screen, teams |

---

## Task 1: DB migration — 8 new columns

**Files:**
- Create: `supabase/migrations/20260412130000_comicvine_v2.sql`
- Regenerate: `src/types/database.generated.ts`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260412130000_comicvine_v2.sql
ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS issue_count integer,
  ADD COLUMN IF NOT EXISTS creators text[],
  ADD COLUMN IF NOT EXISTS enemies text[],
  ADD COLUMN IF NOT EXISTS friends text[],
  ADD COLUMN IF NOT EXISTS movies text[],
  ADD COLUMN IF NOT EXISTS teams text[];
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with the SQL above. Name it `comicvine_v2`.

- [ ] **Step 3: Regenerate database.generated.ts**

Use the `mcp__supabase__generate_typescript_types` tool. Overwrite `src/types/database.generated.ts` with the result.

Verify the new columns appear in the generated type for the `heroes` table — look for `description`, `origin`, `issue_count`, `creators`, `enemies`, `friends`, `movies`, `teams`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260412130000_comicvine_v2.sql src/types/database.generated.ts
git commit -m "feat(db): add 8 new ComicVine enrichment columns to heroes table"
```

---

## Task 2: Extend TypeScript types and data layer

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/db/heroes.ts`
- Modify: `__tests__/lib/db/heroes.test.ts`

- [ ] **Step 1: Write failing tests for new heroRowToCharacterData mappings**

Add these two describe blocks to the end of `__tests__/lib/db/heroes.test.ts` (after the existing `heroRowToCharacterData — powers mapping` block). Also update the `baseHero` fixture to include the 8 new columns (all null):

First, update `baseHero` (around line 300) to add the new nullable columns so TypeScript doesn't complain:

```typescript
const baseHero: HeroRow = {
  // ... all existing fields unchanged ...
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
  height_imperial: '6\'2"',
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
  // new v2 columns
  description: null,
  origin: null,
  issue_count: null,
  creators: null,
  enemies: null,
  friends: null,
  movies: null,
  teams: null,
};
```

Also update the `hero` fixture inside the existing `heroRowToCharacterData` describe block (the one using `satisfies Hero`) by adding the same 8 null fields to it.

Then add new tests at the end of the file:

```typescript
describe('heroRowToCharacterData — v2 comicvine fields', () => {
  it('maps description to details.description', () => {
    const hero: HeroRow = { ...baseHero, description: 'A bitten spider gave him powers.' };
    const result = heroRowToCharacterData(hero);
    expect(result.details.description).toBe('A bitten spider gave him powers.');
  });

  it('maps null description to null', () => {
    const result = heroRowToCharacterData({ ...baseHero, description: null });
    expect(result.details.description).toBeNull();
  });

  it('maps origin to details.origin', () => {
    const hero: HeroRow = { ...baseHero, origin: 'Mutant' };
    const result = heroRowToCharacterData(hero);
    expect(result.details.origin).toBe('Mutant');
  });

  it('maps issue_count to details.issueCount', () => {
    const hero: HeroRow = { ...baseHero, issue_count: 4891 };
    const result = heroRowToCharacterData(hero);
    expect(result.details.issueCount).toBe(4891);
  });

  it('maps creators array to details.creators', () => {
    const hero: HeroRow = { ...baseHero, creators: ['Stan Lee', 'Steve Ditko'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.creators).toEqual(['Stan Lee', 'Steve Ditko']);
  });

  it('maps enemies array to details.enemies', () => {
    const hero: HeroRow = { ...baseHero, enemies: ['Green Goblin', 'Venom'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.enemies).toEqual(['Green Goblin', 'Venom']);
  });

  it('maps friends array to details.friends', () => {
    const hero: HeroRow = { ...baseHero, friends: ['Iron Man', 'Captain America'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.friends).toEqual(['Iron Man', 'Captain America']);
  });

  it('maps movies array to details.movies', () => {
    const hero: HeroRow = { ...baseHero, movies: ['Spider-Man: No Way Home (2021)'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.movies).toEqual(['Spider-Man: No Way Home (2021)']);
  });

  it('maps teams array to details.teams', () => {
    const hero: HeroRow = { ...baseHero, teams: ['Avengers', 'S.H.I.E.L.D.'] };
    const result = heroRowToCharacterData(hero);
    expect(result.details.teams).toEqual(['Avengers', 'S.H.I.E.L.D.']);
  });

  it('maps all null v2 fields to null', () => {
    const result = heroRowToCharacterData(baseHero);
    expect(result.details.description).toBeNull();
    expect(result.details.origin).toBeNull();
    expect(result.details.issueCount).toBeNull();
    expect(result.details.creators).toBeNull();
    expect(result.details.enemies).toBeNull();
    expect(result.details.friends).toBeNull();
    expect(result.details.movies).toBeNull();
    expect(result.details.teams).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn test:ci --testPathPattern="heroes.test"
```

Expected: TypeScript errors because `HeroDetails` doesn't have the new fields yet, and `baseHero` is missing new columns.

- [ ] **Step 3: Extend HeroDetails in src/types/index.ts**

Replace the existing `HeroDetails` interface:

```typescript
export interface HeroDetails {
  summary: string | null;
  publisher: string | null;
  firstIssueId: string | null;
  powers: string[] | null;
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

- [ ] **Step 4: Update fetchHeroDetails in src/lib/api.ts**

Replace the entire `fetchHeroDetails` function:

```typescript
export async function fetchHeroDetails(heroId: string, heroName: string): Promise<HeroDetails> {
  const { data, error } = await supabase.functions.invoke<{
    summary: string | null;
    publisher: string | null;
    firstIssueId: string | null;
    powers: string[] | null;
    description: string | null;
    origin: string | null;
    issueCount: number | null;
    creators: string[] | null;
    enemies: string[] | null;
    friends: string[] | null;
    movies: string[] | null;
    teams: string[] | null;
  }>('get-comicvine-hero', { body: { heroId, heroName } });

  if (error) console.warn('[fetchHeroDetails] error:', error.message, error);
  if (error || !data) {
    return {
      summary: null,
      publisher: null,
      firstIssueId: null,
      powers: null,
      description: null,
      origin: null,
      issueCount: null,
      creators: null,
      enemies: null,
      friends: null,
      movies: null,
      teams: null,
    };
  }

  return {
    summary: data.summary ?? null,
    publisher: data.publisher ?? null,
    firstIssueId: data.firstIssueId ?? null,
    powers: data.powers ?? null,
    description: data.description ?? null,
    origin: data.origin ?? null,
    issueCount: data.issueCount ?? null,
    creators: data.creators ?? null,
    enemies: data.enemies ?? null,
    friends: data.friends ?? null,
    movies: data.movies ?? null,
    teams: data.teams ?? null,
  };
}
```

- [ ] **Step 5: Update heroRowToCharacterData in src/lib/db/heroes.ts**

In the `details` block of `heroRowToCharacterData`, replace:

```typescript
details: {
  summary: hero.summary ?? null,
  publisher: hero.publisher ?? null,
  firstIssueId: null,
  powers: hero.powers ?? null,
},
```

With:

```typescript
details: {
  summary: hero.summary ?? null,
  publisher: hero.publisher ?? null,
  firstIssueId: null,
  powers: (hero.powers as string[] | null) ?? null,
  description: hero.description ?? null,
  origin: hero.origin ?? null,
  issueCount: hero.issue_count ?? null,
  creators: (hero.creators as string[] | null) ?? null,
  enemies: (hero.enemies as string[] | null) ?? null,
  friends: (hero.friends as string[] | null) ?? null,
  movies: (hero.movies as string[] | null) ?? null,
  teams: (hero.teams as string[] | null) ?? null,
},
```

- [ ] **Step 6: Update the null HeroDetails initialiser in app/character/[id].tsx**

There are two places in `app/character/[id].tsx` where `details` is set to a null initialiser. Find them both (search for `summary: null, publisher: null, firstIssueId: null`) and replace each with:

```typescript
details: {
  summary: null,
  publisher: null,
  firstIssueId: null,
  powers: null,
  description: null,
  origin: null,
  issueCount: null,
  creators: null,
  enemies: null,
  friends: null,
  movies: null,
  teams: null,
},
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
yarn test:ci --testPathPattern="heroes.test"
```

Expected: All tests pass including the new v2 mapping tests.

- [ ] **Step 8: Run full test suite**

```bash
yarn test:ci
```

Expected: Same pass count as before (65 tests) — only `api.test.ts` suite fails due to a pre-existing AsyncStorage mock issue unrelated to this change.

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/lib/api.ts src/lib/db/heroes.ts __tests__/lib/db/heroes.test.ts app/character/'[id].tsx'
git commit -m "feat(types): extend HeroDetails with 8 new ComicVine v2 fields"
```

---

## Task 3: Expand the edge function

**Files:**
- Modify: `supabase/functions/get-comicvine-hero/index.ts`

No unit tests — the edge function runs in Deno and calls an external API. Correctness is verified manually after deploy.

- [ ] **Step 1: Replace the edge function with the expanded version**

Full replacement of `supabase/functions/get-comicvine-hero/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COMICVINE_API_KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const NULL_RESPONSE = {
  summary: null,
  publisher: null,
  firstIssueId: null,
  powers: null,
  description: null,
  origin: null,
  issueCount: null,
  creators: null,
  enemies: null,
  friends: null,
  movies: null,
  teams: null,
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId, heroName } = await req.json() as { heroId: string; heroName: string };
    if (!heroId || !heroName) return json({ error: 'heroId and heroName required' }, 400);

    // List endpoint — character id, deck, publisher, first issue
    const listParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      filter: `name:${heroName}`,
      field_list: 'id,deck,publisher,first_appeared_in_issue',
      limit: '1',
    });

    const listRes = await fetch(`${COMICVINE_BASE}/characters/?${listParams}`);
    if (!listRes.ok) return json({ error: `ComicVine error: ${listRes.status}` }, 502);

    const listJson = await listRes.json();
    const result = listJson.results?.[0];

    if (!result) return json(NULL_RESPONSE);

    const summary: string | null = result.deck ?? null;
    const publisher: string | null = result.publisher?.name ?? null;
    const firstIssueId: string | null = result.first_appeared_in_issue?.id
      ? String(result.first_appeared_in_issue.id)
      : null;

    // Detail endpoint — powers + all v2 fields
    let powers: string[] | null = null;
    let description: string | null = null;
    let origin: string | null = null;
    let issueCount: number | null = null;
    let creators: string[] | null = null;
    let enemies: string[] | null = null;
    let friends: string[] | null = null;
    let movies: string[] | null = null;
    let teams: string[] | null = null;

    if (result.id) {
      const detailParams = new URLSearchParams({
        api_key: COMICVINE_API_KEY,
        format: 'json',
        field_list: [
          'powers',
          'origin',
          'character_enemies',
          'character_friends',
          'creators',
          'count_of_issue_appearances',
          'movies',
          'description',
          'teams',
        ].join(','),
      });

      const detailRes = await fetch(`${COMICVINE_BASE}/character/4005-${result.id}/?${detailParams}`);
      if (detailRes.ok) {
        const d = (await detailRes.json()).results ?? {};

        // powers
        const rawPowers: string[] = Array.isArray(d.powers)
          ? d.powers
              .map((p: unknown) =>
                p && typeof (p as Record<string, unknown>).name === 'string'
                  ? ((p as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
          : [];
        powers = rawPowers.length > 0 ? rawPowers : null;

        // description — strip HTML
        const rawDesc: string = typeof d.description === 'string' ? d.description : '';
        const stripped = rawDesc ? stripHtml(rawDesc) : '';
        description = stripped.length > 0 ? stripped : null;

        // origin
        origin = typeof d.origin?.name === 'string' ? d.origin.name : null;

        // issue count
        issueCount = typeof d.count_of_issue_appearances === 'number'
          ? d.count_of_issue_appearances
          : null;

        // creators — names only, capped at 5
        creators = Array.isArray(d.creators)
          ? d.creators
              .map((c: unknown) =>
                c && typeof (c as Record<string, unknown>).name === 'string'
                  ? ((c as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 5)
          : null;
        if (creators?.length === 0) creators = null;

        // enemies
        const rawEnemies: string[] = Array.isArray(d.character_enemies)
          ? d.character_enemies
              .map((e: unknown) =>
                e && typeof (e as Record<string, unknown>).name === 'string'
                  ? ((e as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 20)
          : [];
        enemies = rawEnemies.length > 0 ? rawEnemies : null;

        // friends
        const rawFriends: string[] = Array.isArray(d.character_friends)
          ? d.character_friends
              .map((f: unknown) =>
                f && typeof (f as Record<string, unknown>).name === 'string'
                  ? ((f as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 20)
          : [];
        friends = rawFriends.length > 0 ? rawFriends : null;

        // movies — "Title (YYYY)" formatted strings
        const rawMovies: string[] = Array.isArray(d.movies)
          ? d.movies
              .map((m: unknown) => {
                if (!m || typeof (m as Record<string, unknown>).name !== 'string') return null;
                const name = (m as Record<string, unknown>).name as string;
                const date = (m as Record<string, unknown>).date;
                const year = typeof date === 'string' ? date.slice(0, 4) : null;
                return year ? `${name} (${year})` : name;
              })
              .filter((s: string | null): s is string => s !== null)
          : [];
        movies = rawMovies.length > 0 ? rawMovies : null;

        // teams — names, capped at 20
        const rawTeams: string[] = Array.isArray(d.teams)
          ? d.teams
              .map((t: unknown) =>
                t && typeof (t as Record<string, unknown>).name === 'string'
                  ? ((t as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 20)
          : [];
        teams = rawTeams.length > 0 ? rawTeams : null;
      }
    }

    // Write to DB — no IS NULL condition so previously-enriched heroes get new columns
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    await supabase
      .from('heroes')
      .update({
        summary,
        powers,
        description,
        origin,
        issue_count: issueCount,
        creators,
        enemies,
        friends,
        movies,
        teams,
        comicvine_enriched_at: new Date().toISOString(),
      })
      .eq('id', heroId);

    return json({ summary, publisher, firstIssueId, powers, description, origin, issueCount, creators, enemies, friends, movies, teams });
  } catch (err) {
    console.error('[get-comicvine-hero]', err);
    return json(NULL_RESPONSE, 500);
  }
});
```

- [ ] **Step 2: Deploy the edge function via Supabase MCP**

Use `mcp__supabase__deploy_edge_function` to deploy `get-comicvine-hero`.

- [ ] **Step 3: Commit**

```bash
git add 'supabase/functions/get-comicvine-hero/index.ts'
git commit -m "feat(edge): expand ComicVine detail fetch to origin, enemies, allies, creators, movies, teams"
```

---

## Task 4: Identity block — origin badge, issue count, creator credit, re-enrichment trigger

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add ORIGIN_CONFIG constant and OriginBadge component**

Add these after the existing `ALIGNMENT_CONFIG` / `AlignmentBadge` block (around line 81):

```typescript
const ORIGIN_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  mutant:        { label: 'Mutant',    bg: 'rgba(139,92,246,0.15)',  color: '#7c3aed' },
  alien:         { label: 'Alien',     bg: 'rgba(21,161,171,0.15)',  color: COLORS.blue },
  human:         { label: 'Human',     bg: 'rgba(162,161,155,0.15)', color: COLORS.grey },
  'god/eternal': { label: 'Eternal',   bg: 'rgba(249,178,34,0.18)',  color: '#b07d00' },
  radiation:     { label: 'Radiation', bg: 'rgba(231,115,51,0.15)',  color: COLORS.orange },
  cyborg:        { label: 'Cyborg',    bg: 'rgba(45,45,45,0.12)',    color: COLORS.black },
  robot:         { label: 'Robot',     bg: 'rgba(45,45,45,0.12)',    color: COLORS.black },
  training:      { label: 'Training',  bg: 'rgba(80,35,20,0.12)',    color: COLORS.brown },
  inhuman:       { label: 'Inhuman',   bg: 'rgba(21,161,171,0.15)',  color: COLORS.blue },
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

- [ ] **Step 2: Render OriginBadge in the nameRowRight**

Find the `nameRowRight` View (around the identity block JSX) and add `<OriginBadge>` alongside `<AlignmentBadge>`:

```tsx
<View style={styles.nameRowRight}>
  <AlignmentBadge alignment={data.stats.biography.alignment} />
  <OriginBadge origin={data.details.origin} />
  <Text style={styles.heroPublisher}>{data.stats.biography.publisher}</Text>
</View>
```

- [ ] **Step 3: Add issue count and creator credit lines**

Add this block after the `nameRow` View and before the `nameDivider`, still inside the `data ?` branch:

```tsx
{((data.details.issueCount ?? 0) > 0 || (data.details.creators?.length ?? 0) > 0) ? (
  <View style={styles.heroMeta}>
    {(data.details.issueCount ?? 0) > 0 ? (
      <Text style={styles.heroMetaText}>
        Featured in {data.details.issueCount!.toLocaleString()} issues
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

- [ ] **Step 4: Add the re-enrichment trigger**

In the Supabase fast-path block (look for `const needsComicVine = !hero.comicvine_enriched_at || hero.powers === null`), change it to:

```typescript
const needsComicVine = !hero.comicvine_enriched_at || hero.powers === null || hero.origin === null;
```

- [ ] **Step 5: Add new styles**

Add to the `StyleSheet.create` block:

```typescript
heroMeta: {
  marginTop: 6,
  gap: 2,
},
heroMetaText: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 11,
  color: COLORS.navy,
  opacity: 0.5,
},
```

- [ ] **Step 6: Run tests**

```bash
yarn test:ci
```

Expected: Same pass count — these are UI-only changes with no new logic to unit test.

- [ ] **Step 7: Commit**

```bash
git add 'app/character/[id].tsx'
git commit -m "feat(character): add origin badge, issue count, creator credit to identity block"
```

---

## Task 5: Expandable About section (description)

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add the AboutBlock component**

Add this function after the `RelativesList` component (before `export default function CharacterScreen`):

```typescript
function AboutBlock({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.aboutBlock}>
      <Text style={styles.aboutText} numberOfLines={expanded ? undefined : 4}>
        {description}
      </Text>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.aboutToggle}>{expanded ? 'Show less' : 'Read more'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: Render AboutBlock after the summaryBlock**

Find the summary rendering block (the `comicVineLoading ? ... : data.details.summary ? ...` section). Immediately after the closing block (after the summary `View`), add:

```tsx
{!comicVineLoading && data.details.description ? (
  <AboutBlock description={data.details.description} />
) : null}
```

- [ ] **Step 3: Add styles**

```typescript
aboutBlock: {
  paddingHorizontal: 20,
  paddingBottom: 8,
},
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

- [ ] **Step 4: Run tests**

```bash
yarn test:ci
```

Expected: Same pass count.

- [ ] **Step 5: Commit**

```bash
git add 'app/character/[id].tsx'
git commit -m "feat(character): add expandable About section for ComicVine full description"
```

---

## Task 6: Enemies & Allies section

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add the CharacterChips component**

Add after `AboutBlock`:

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
            style={[styles.chip, isEnemy ? styles.chipEnemy : styles.chipAlly]}
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

- [ ] **Step 2: Render the Enemies & Allies section**

Add this new Section between the Overview Section and the Appearance Section:

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

- [ ] **Step 3: Add styles**

```typescript
characterChipsBlock: {
  marginBottom: 10,
},
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
chipTextAlly: { color: COLORS.green },
```

- [ ] **Step 4: Run tests**

```bash
yarn test:ci
```

Expected: Same pass count.

- [ ] **Step 5: Commit**

```bash
git add 'app/character/[id].tsx'
git commit -m "feat(character): add Enemies and Allies section with colour-coded chips"
```

---

## Task 7: On Screen section (movies)

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Render the On Screen section**

Add this new Section after Enemies & Allies and before Appearance:

```tsx
{data.details.movies?.length ? (
  <Section title="On Screen">
    {data.details.movies.map((entry, i) => {
      const match = entry.match(/^(.+?)\s*\((\d{4})\)$/);
      const title = match ? match[1] : entry;
      const year = match ? match[2] : null;
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

- [ ] **Step 2: Add styles**

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

- [ ] **Step 3: Run tests**

```bash
yarn test:ci
```

Expected: Same pass count.

- [ ] **Step 4: Commit**

```bash
git add 'app/character/[id].tsx'
git commit -m "feat(character): add On Screen section listing movie and TV appearances"
```

---

## Task 8: Connections — use teams when available

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Update the AffiliationChips data source**

Find the `AffiliationChips` usage in the Connections Section. It currently reads:

```tsx
<AffiliationChips value={data.stats.connections['group-affiliation']} />
```

Replace with:

```tsx
<AffiliationChips
  value={
    data.details.teams?.length
      ? data.details.teams.join(', ')
      : data.stats.connections['group-affiliation']
  }
/>
```

- [ ] **Step 2: Run tests**

```bash
yarn test:ci
```

Expected: Same pass count.

- [ ] **Step 3: Commit**

```bash
git add 'app/character/[id].tsx'
git commit -m "feat(character): prefer ComicVine structured teams over SuperheroAPI affiliation string"
```
