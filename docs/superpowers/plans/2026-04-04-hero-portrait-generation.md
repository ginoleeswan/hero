# Hero Portrait Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate consistent Mike Mitchell–style portraits for all 564 heroes via Gemini image-to-image, store them in Supabase Storage, and wire the app to display them.

**Architecture:** A standalone Bun script uploads the 34 existing curated images to Supabase Storage (Phase 1), then generates AI portraits for the remaining ~530 heroes using Gemini 2.0 Flash with `spiderman.jpg` as a style reference (Phase 2). A new `portrait_url` column on `heroes` stores the public Storage URL, and `heroImageSource()` is updated to prefer it over all other sources.

**Tech Stack:** Bun, Supabase Storage (MCP + `@supabase/supabase-js`), Google Gemini 2.0 Flash (`generativelanguage.googleapis.com`), jest-expo + @testing-library/react-native for tests.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260404120000_add_portrait_url.sql` | Create | Add `portrait_url` column + create storage bucket |
| `src/types/database.generated.ts` | Regenerate | Picks up `portrait_url: string \| null` automatically |
| `src/constants/heroImages.ts` | Modify | Add `portraitUrl` param to `heroImageSource()` |
| `src/lib/db/heroes.ts` | Modify | Add `portrait_url` to `HeroSearchResult` Pick + `searchHeroes` select + `heroRowToCharacterData` |
| `src/lib/db/favourites.ts` | Modify | Add `portrait_url` to `FavouriteHero` Pick + `getUserFavouriteHeroes` select |
| `src/components/HeroCard.tsx` | Modify | Add `portraitUrl` prop, pass to `heroImageSource` |
| `app/(tabs)/index.tsx` | Modify | Pass `portrait_url` to `HeroCard` |
| `app/(tabs)/search.tsx` | Modify | Prefer `portrait_url` in search result avatar |
| `app/(tabs)/profile.tsx` | Modify | Pass `portrait_url` to `FavouriteThumb` |
| `app/character/[id].tsx` | Modify | Prefer `portrait_url` in `heroImage` chain |
| `scripts/generate-portraits.ts` | Create | Batch upload + Gemini generation script |
| `__tests__/lib/heroImages.test.ts` | Create | Unit tests for updated `heroImageSource()` |
| `__tests__/lib/db/heroes.test.ts` | Modify | Add `portrait_url` to fixture + new `heroRowToCharacterData` test |
| `__tests__/components/HeroCard.test.tsx` | Modify | Add `portraitUrl` prop to render call |

---

## Task 1: DB migration — add `portrait_url` column

**Files:**
- Create: `supabase/migrations/20260404120000_add_portrait_url.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260404120000_add_portrait_url.sql
ALTER TABLE heroes ADD COLUMN portrait_url text;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with:
- name: `add_portrait_url`
- query: the SQL above

- [ ] **Step 3: Verify the column exists**

Run:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'heroes' AND column_name = 'portrait_url';
```
Expected: one row — `portrait_url | text`

- [ ] **Step 4: Regenerate database types**

Use `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts`.

- [ ] **Step 5: Verify `portrait_url` appears in generated types**

Open `src/types/database.generated.ts` and confirm the `heroes` row type includes:
```ts
portrait_url: string | null
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260404120000_add_portrait_url.sql src/types/database.generated.ts
git commit -m "feat(db): add portrait_url column to heroes"
```

---

## Task 2: Create Supabase Storage bucket

**Files:** (Supabase dashboard / MCP only — no source files)

- [ ] **Step 1: Create the `hero-portraits` bucket**

Run SQL via `mcp__supabase__execute_sql`:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-portraits', 'hero-portraits', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Add RLS policies for public read and authenticated write**

```sql
-- Public read
CREATE POLICY "Public read hero portraits"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-portraits');

-- Authenticated write (service role used by script)
CREATE POLICY "Authenticated write hero portraits"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hero-portraits');
```

- [ ] **Step 3: Verify bucket exists**

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'hero-portraits';
```
Expected: one row with `public = true`

- [ ] **Step 4: Commit**

```bash
git add -p  # nothing to stage — bucket is in Supabase, not in source
git commit --allow-empty -m "chore(storage): create hero-portraits bucket"
```

---

## Task 3: Update `heroImageSource()` — add `portraitUrl` parameter

**Files:**
- Modify: `src/constants/heroImages.ts`
- Create: `__tests__/lib/heroImages.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/heroImages.test.ts`:

```ts
// __tests__/lib/heroImages.test.ts
jest.mock('../../assets/images/spiderman.jpg', () => 1, { virtual: true });
jest.mock('../../assets/images/ironman.jpg', () => 2, { virtual: true });

import { heroImageSource } from '../../src/constants/heroImages';

describe('heroImageSource', () => {
  it('returns portraitUrl as uri when provided', () => {
    const result = heroImageSource('999', null, 'https://storage.example.com/999.jpg');
    expect(result).toEqual({ uri: 'https://storage.example.com/999.jpg' });
  });

  it('prefers portraitUrl over local HERO_IMAGES', () => {
    // id '620' has a local bundled image
    const result = heroImageSource('620', null, 'https://storage.example.com/620.jpg');
    expect(result).toEqual({ uri: 'https://storage.example.com/620.jpg' });
  });

  it('falls back to local HERO_IMAGES when portraitUrl is null', () => {
    const result = heroImageSource('620', null, null);
    expect(typeof result).toBe('number'); // bundled require() returns a number
  });

  it('falls back to imageUrl when no portrait and no local image', () => {
    const result = heroImageSource('999', 'https://cdn.example.com/999.jpg', null);
    expect(result).toEqual({ uri: 'https://cdn.example.com/999.jpg' });
  });

  it('falls back to CDN when nothing else is available', () => {
    const result = heroImageSource('999', null, null);
    expect(result).toEqual({ uri: 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md/999.jpg' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test:ci -- --testPathPattern="heroImages"
```
Expected: FAIL — `heroImageSource` doesn't accept third argument yet

- [ ] **Step 3: Update `heroImageSource()` in `src/constants/heroImages.ts`**

Replace the existing `heroImageSource` function:

```ts
export function heroImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
): number | { uri: string } {
  if (portraitUrl) return { uri: portraitUrl };
  if (imageUrl && HERO_IMAGES[imageUrl]) return HERO_IMAGES[imageUrl];
  const local = HERO_IMAGES[String(id)];
  if (local) return local;
  if (imageUrl && imageUrl.startsWith('http')) return { uri: imageUrl };
  return { uri: `${CDN_BASE}/${id}.jpg` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test:ci -- --testPathPattern="heroImages"
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/constants/heroImages.ts __tests__/lib/heroImages.test.ts
git commit -m "feat(images): add portraitUrl param to heroImageSource"
```

---

## Task 4: Update `heroes.ts` — add `portrait_url` to queries and mapping

**Files:**
- Modify: `src/lib/db/heroes.ts`
- Modify: `__tests__/lib/db/heroes.test.ts`

- [ ] **Step 1: Add a failing test for `heroRowToCharacterData` with `portrait_url`**

In `__tests__/lib/db/heroes.test.ts`, add `portrait_url` to the `hero` fixture and add a test. Find the `hero` constant and add the field:

```ts
const hero = {
  // ... all existing fields ...
  portrait_url: 'https://storage.example.com/portraits/620.jpg',
} satisfies Hero;
```

Then add inside the `describe('heroRowToCharacterData', ...)` block:

```ts
it('uses portrait_url as the image url when set', () => {
  const data = heroRowToCharacterData(hero);
  expect(data.stats.image.url).toBe('https://storage.example.com/portraits/620.jpg');
});

it('falls back to image_url when portrait_url is null', () => {
  const data = heroRowToCharacterData({ ...hero, portrait_url: null });
  expect(data.stats.image.url).toBe('https://cdn.example.com/lg.jpg');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test:ci -- --testPathPattern="heroes"
```
Expected: FAIL — `portrait_url` not in `HeroSearchResult`, fixture type error

- [ ] **Step 3: Update `src/lib/db/heroes.ts`**

1. Add `portrait_url` to `HeroSearchResult`:
```ts
export type HeroSearchResult = Pick<
  Hero,
  'id' | 'name' | 'publisher' | 'image_md_url' | 'image_url' | 'portrait_url'
>;
```

2. Add `portrait_url` to `searchHeroes` select:
```ts
let q = supabase
  .from('heroes')
  .select('id, name, publisher, image_md_url, image_url, portrait_url')
  .order('name')
  .limit(100);
```

3. Update `heroRowToCharacterData` — prefer `portrait_url` in `stats.image.url`:
```ts
image: {
  url: hero.portrait_url ?? hero.image_url ?? '',
},
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test:ci -- --testPathPattern="heroes"
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.test.ts
git commit -m "feat(db): include portrait_url in hero queries and mapping"
```

---

## Task 5: Update `favourites.ts` — add `portrait_url` to `FavouriteHero`

**Files:**
- Modify: `src/lib/db/favourites.ts`

- [ ] **Step 1: Update `FavouriteHero` type and `getUserFavouriteHeroes` select**

In `src/lib/db/favourites.ts`:

1. Extend the `FavouriteHero` type:
```ts
export type FavouriteHero = Pick<Tables<'heroes'>, 'id' | 'name' | 'image_url' | 'portrait_url'>;
```

2. Update the select in `getUserFavouriteHeroes`:
```ts
const { data: heroData, error: heroError } = await supabase
  .from('heroes')
  .select('id, name, image_url, portrait_url')
  .in('id', heroIds);
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
bun run test:ci
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/favourites.ts
git commit -m "feat(db): include portrait_url in FavouriteHero"
```

---

## Task 6: Update `HeroCard` component — add `portraitUrl` prop

**Files:**
- Modify: `src/components/HeroCard.tsx`
- Modify: `__tests__/components/HeroCard.test.tsx`

- [ ] **Step 1: Update `HeroCard.test.tsx` to pass `portraitUrl`**

The test currently renders without `portraitUrl`. It should still pass as the prop is optional, but update it to also test the portrait path. Replace the existing test:

```tsx
describe('HeroCard', () => {
  it('renders the hero name', () => {
    const { getByText } = render(
      <HeroCard id="620" name="Spider-Man" imageUrl={null} onPress={() => {}} />,
    );
    expect(getByText('Spider-Man')).toBeTruthy();
  });

  it('renders with a portraitUrl without crashing', () => {
    const { getByText } = render(
      <HeroCard
        id="620"
        name="Spider-Man"
        imageUrl={null}
        portraitUrl="https://storage.example.com/620.jpg"
        onPress={() => {}}
      />,
    );
    expect(getByText('Spider-Man')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to confirm second test fails**

```bash
bun run test:ci -- --testPathPattern="HeroCard"
```
Expected: FAIL — `portraitUrl` prop not accepted

- [ ] **Step 3: Update `HeroCard.tsx`**

```tsx
interface HeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  portraitUrl?: string | null;
  onPress: () => void;
}

export function HeroCard({ id, name, imageUrl, portraitUrl, onPress }: HeroCardProps) {
  const imageSource = heroImageSource(id, imageUrl, portraitUrl);
  // ... rest unchanged
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test:ci -- --testPathPattern="HeroCard"
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/HeroCard.tsx __tests__/components/HeroCard.test.tsx
git commit -m "feat(HeroCard): accept portraitUrl prop"
```

---

## Task 7: Wire up call sites

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/search.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Update `app/(tabs)/index.tsx` — pass `portrait_url` to `HeroCard`**

In the `renderItem` of `HeroRow`, find the `HeroCard` usage and add `portraitUrl`:

```tsx
<HeroCard
  id={item.id}
  name={item.name}
  imageUrl={item.image_url}
  portraitUrl={item.portrait_url}
  onPress={() => onPress(item)}
/>
```

`getHeroesByCategory()` uses `select('*')` so `portrait_url` is already included after the migration.

- [ ] **Step 2: Update `app/(tabs)/search.tsx` — prefer `portrait_url` in avatar**

Find the avatar `Image` in the `renderItem` and update its `source`:

```tsx
<Image
  source={{ uri: item.portrait_url ?? item.image_md_url ?? item.image_url ?? undefined }}
  style={styles.avatar}
  contentFit="cover"
  placeholder="#d4c8b8"
  transition={200}
/>
```

Also update the `handlePress` call to pass `portrait_url ?? image_url` as `imageUri`:
```tsx
onPress={() => handlePress(item.id, item.name, item.portrait_url ?? item.image_url ?? '')}
```

- [ ] **Step 3: Update `app/(tabs)/profile.tsx` — pass `portrait_url` to `FavouriteThumb`**

`FavouriteThumb` currently calls `heroImageSource(hero.id, hero.image_url)`. Update it:

```tsx
const src = heroImageSource(hero.id, hero.image_url, hero.portrait_url);
```

- [ ] **Step 4: Update `app/character/[id].tsx` — prefer `portrait_url` in `heroImage` chain**

The `heroImage` chain currently checks `HERO_IMAGES[id]` first. Since `heroRowToCharacterData` now sets `stats.image.url` to `portrait_url ?? image_url`, no changes are needed here — the portrait flows through automatically. However, the `paramImageUri` passed from Search should also prefer the portrait. Update `handlePress` in `search.tsx` (already done in Step 2 above).

- [ ] **Step 5: Run full test suite**

```bash
bun run test:ci
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/index.tsx app/(tabs)/search.tsx app/(tabs)/profile.tsx app/character/[id].tsx
git commit -m "feat: wire portrait_url through all hero display surfaces"
```

---

## Task 8: Write the batch generation script

**Files:**
- Create: `scripts/generate-portraits.ts`

- [ ] **Step 1: Check `.env.local` has the required keys**

Open `.env.local` and confirm these are present (add if missing — do not commit):
```
EXPO_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_AI_STUDIO_API_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is the service role key from the Supabase dashboard (Settings → API). It is never used in the app bundle — only in this script.

- [ ] **Step 2: Create `scripts/generate-portraits.ts`**

```ts
#!/usr/bin/env bun
/**
 * Hero portrait generation script.
 *
 * Phase 1: Upload the 34 existing curated local images to Supabase Storage.
 * Phase 2: For each remaining hero (portrait_url IS NULL), fetch their API
 *          image, send it + spiderman.jpg to Gemini 2.0 Flash for style
 *          transfer, upload result to Supabase Storage, and write portrait_url
 *          back to the DB.
 *
 * Usage:
 *   bun scripts/generate-portraits.ts               # full batch
 *   bun scripts/generate-portraits.ts --hero-id 69  # single hero (test)
 *   bun scripts/generate-portraits.ts --dry-run     # log without API calls
 *   bun scripts/generate-portraits.ts --concurrency 5
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY!;

const BUCKET = 'hero-portraits';
const GEMINI_MODEL = 'gemini-2.0-flash-preview-image-generation';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Style reference: the Spider-Man Mike Mitchell portrait
const STYLE_REF_PATH = join(import.meta.dir, '../assets/images/spiderman.jpg');

const STYLE_PROMPT = `Redraw the character from the first image as a side-profile bust portrait \
in exactly the style of the second reference image: flat graphic illustration, bold solid \
background colour, simplified clean shapes, head and shoulders crop, smooth flat shading \
with subtle gradients, clean outlines, poster art aesthetic. \
Preserve the character's costume colours and identity. Do not include any text.`;

// The 34 heroes that already have curated local images (id → local file path)
const LOCAL_PORTRAITS: Record<string, string> = {
  '620': 'assets/images/spiderman.jpg',
  '346': 'assets/images/ironman.jpg',
  '70': 'assets/images/batman.jpg',
  '644': 'assets/images/superman.jpg',
  '370': 'assets/images/joker.jpg',
  '149': 'assets/images/captain-america.jpg',
  '226': 'assets/images/doctor-strange.jpg',
  '720': 'assets/images/wonder-woman.jpg',
  '717': 'assets/images/wolverine.jpg',
  '659': 'assets/images/thor.jpg',
  '332': 'assets/images/hulk.jpg',
  '213': 'assets/images/deadpool.jpg',
  '313': 'assets/images/hawkeye.jpg',
  '414': 'assets/images/loki.jpg',
  '687': 'assets/images/venom.jpeg',
  '630': 'assets/images/star-lord.jpg',
  '106': 'assets/images/black-panther.jpg',
  '30': 'assets/images/ant-man.jpg',
  '222': 'assets/images/doctor-doom.jpg',
  '208': 'assets/images/darth-vader.jpg',
  '479': 'assets/images/mysterio.jpg',
  '650': 'assets/images/terminator.jpeg',
  '225': 'assets/images/doctor-octopus.jpg',
  '299': 'assets/images/green-goblin.jpg',
  '423': 'assets/images/magneto.jpg',
  '196': 'assets/images/cyclops.jpg',
  '480': 'assets/images/mystique.jpg',
  '638': 'assets/images/storm.jpg',
  '75': 'assets/images/beast.jpg',
  '567': 'assets/images/rogue.jpg',
  '185': 'assets/images/colossus.png',
  '490': 'assets/images/nightcrawler.jpg',
  '710': 'assets/images/weapon-x.jpg',
  '274': 'assets/images/gambit.jpg',
};

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const heroIdFlag = args.find((_, i) => args[i - 1] === '--hero-id') ?? null;
const dryRun = args.includes('--dry-run');
const concurrencyArg = args.find((_, i) => args[i - 1] === '--concurrency');
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg, 10) : 3;

// ─── Supabase client (service role — write access to Storage) ─────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadToStorage(heroId: string, imageBytes: Uint8Array): Promise<string> {
  const fileName = `${heroId}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, imageBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed for ${heroId}: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

async function setPortraitUrl(heroId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from('heroes')
    .update({ portrait_url: url })
    .eq('id', heroId);
  if (error) throw new Error(`DB update failed for ${heroId}: ${error.message}`);
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
  return { base64, mimeType };
}

async function generatePortrait(
  sourceBase64: string,
  sourceMime: string,
  heroName: string,
): Promise<Uint8Array> {
  const styleRefBytes = readFileSync(STYLE_REF_PATH);
  const styleRefBase64 = styleRefBytes.toString('base64');

  const body = {
    contents: [{
      parts: [
        { text: `Character name: ${heroName}. ${STYLE_PROMPT}` },
        { inline_data: { mime_type: sourceMime, data: sourceBase64 } },
        { inline_data: { mime_type: 'image/jpeg', data: styleRefBase64 } },
      ],
    }],
    generationConfig: {
      responseModalities: ['image', 'text'],
    },
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`  ↻ Retrying in ${delay}ms (attempt ${attempt + 1}/4)…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      lastError = new Error('Rate limited');
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const json = await res.json() as {
      candidates: Array<{
        content: { parts: Array<{ inline_data?: { data: string } }> }
      }>
    };

    const imagePart = json.candidates?.[0]?.content?.parts?.find((p) => p.inline_data?.data);
    if (!imagePart?.inline_data?.data) throw new Error('No image in Gemini response');

    return Buffer.from(imagePart.inline_data.data, 'base64');
  }
  throw lastError ?? new Error('Gemini request failed after retries');
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

// ─── Phase 1: Upload existing curated portraits ───────────────────────────────

async function phase1(): Promise<void> {
  console.log('\n═══ Phase 1: Uploading existing curated portraits ═══\n');

  const entries = Object.entries(LOCAL_PORTRAITS);
  for (const [heroId, relativePath] of entries) {
    // Check if already done
    const { data } = await supabase
      .from('heroes')
      .select('portrait_url, name')
      .eq('id', heroId)
      .single();

    if (data?.portrait_url) {
      console.log(`  ✓ ${data.name} (${heroId}) already uploaded — skipping`);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Would upload ${relativePath} for hero ${heroId}`);
      continue;
    }

    const absPath = join(import.meta.dir, '..', relativePath);
    const bytes = readFileSync(absPath);
    const url = await uploadToStorage(heroId, new Uint8Array(bytes));
    await setPortraitUrl(heroId, url);
    console.log(`  ✓ ${data?.name ?? heroId} (${heroId}) → ${url}`);
  }
}

// ─── Phase 2: Generate AI portraits for remaining heroes ──────────────────────

async function phase2(filterHeroId?: string): Promise<void> {
  console.log('\n═══ Phase 2: Generating AI portraits ═══\n');

  let query = supabase
    .from('heroes')
    .select('id, name, image_url')
    .is('portrait_url', null)
    .not('image_url', 'is', null)
    .order('name');

  if (filterHeroId) {
    query = query.eq('id', filterHeroId) as typeof query;
  }

  const { data: heroes, error } = await query;
  if (error) throw new Error(`Failed to fetch heroes: ${error.message}`);
  if (!heroes?.length) {
    console.log('No heroes to process.');
    return;
  }

  console.log(`Processing ${heroes.length} heroes with concurrency=${CONCURRENCY}\n`);

  await withConcurrency(heroes, CONCURRENCY, async (hero, idx) => {
    const label = `[${idx + 1}/${heroes.length}] ${hero.name} (${hero.id})`;

    if (dryRun) {
      console.log(`  [dry-run] ${label}`);
      return;
    }

    try {
      console.log(`  ⟳ ${label}`);
      const { base64, mimeType } = await fetchImageAsBase64(hero.image_url!);
      const imageBytes = await generatePortrait(base64, mimeType, hero.name);
      const url = await uploadToStorage(hero.id, imageBytes);
      await setPortraitUrl(hero.id, url);
      console.log(`  ✓ ${label} → ${url}`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
      // Don't throw — continue with remaining heroes
    }
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  }
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY must be set in .env.local');
  }

  console.log(`Hero Portrait Generator`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (heroIdFlag) console.log(`Filter: hero ${heroIdFlag} only`);

  // Phase 1 only runs when not filtering to a single hero
  if (!heroIdFlag) await phase1();
  await phase2(heroIdFlag ?? undefined);

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-portraits.ts
git commit -m "feat(scripts): add hero portrait generation script"
```

---

## Task 9: Test with a single hero

- [ ] **Step 1: Add `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_AI_STUDIO_API_KEY` to `.env.local`**

Get the service role key from Supabase dashboard → Settings → API → Service role key.
Get the Google AI Studio key from aistudio.google.com → API keys.

- [ ] **Step 2: Run dry-run first to check config**

```bash
bun scripts/generate-portraits.ts --hero-id 69 --dry-run
```
Expected output:
```
Hero Portrait Generator
Mode: DRY RUN
Filter: hero 69 only

═══ Phase 2: Generating AI portraits ═══

Processing 1 heroes with concurrency=3

  [dry-run] [1/1] Aquaman (69)

Done.
```

- [ ] **Step 3: Run for real against hero 69 (Aquaman)**

```bash
bun scripts/generate-portraits.ts --hero-id 69
```
Expected: `✓ [1/1] Aquaman (69) → https://...supabase.co/storage/v1/object/public/hero-portraits/69.jpg`

- [ ] **Step 4: Verify in Supabase dashboard**

Open Supabase → Storage → hero-portraits — confirm `69.jpg` exists.

- [ ] **Step 5: Verify `portrait_url` is set in the DB**

```sql
SELECT id, name, portrait_url FROM heroes WHERE id = '69';
```
Expected: `portrait_url` is a valid `https://...supabase.co/...` URL

- [ ] **Step 6: Visually review the generated image**

Open the URL from the DB in a browser. Confirm:
- Side-profile bust portrait ✓
- Flat graphic illustration style ✓
- Bold solid background colour ✓
- Aquaman's costume colours preserved ✓

If quality is poor, adjust the `STYLE_PROMPT` constant in the script and re-run (the `upsert: true` on storage upload will overwrite, and the DB update will refresh the URL).

- [ ] **Step 7: Open the app and navigate to Aquaman's character screen**

```bash
bun start
```
Navigate to Aquaman — confirm the portrait renders from Supabase Storage rather than the CDN fallback.

---

## Task 10: Run the full batch

- [ ] **Step 1: Run Phase 1 (upload 34 curated images)**

```bash
bun scripts/generate-portraits.ts --dry-run
```
Review the output — confirm 34 heroes are listed for Phase 1. Then run live:

```bash
bun scripts/generate-portraits.ts
```

Wait for Phase 1 to complete (fast — just file uploads, no Gemini calls).

- [ ] **Step 2: Monitor Phase 2 progress**

Phase 2 runs with `CONCURRENCY=3` by default. With ~530 heroes and ~10s per image (Gemini latency), expect roughly 30 minutes. Errors are logged but don't abort the run.

If the run is interrupted, re-run the same command — already-processed heroes are skipped automatically.

- [ ] **Step 3: Check completion**

```sql
SELECT
  COUNT(*) as total,
  COUNT(portrait_url) as with_portrait,
  COUNT(*) - COUNT(portrait_url) as missing
FROM heroes;
```
Expected: `missing` should be close to 0 (a few failures from API timeouts are normal — re-run to fill gaps).

- [ ] **Step 4: Commit final state**

```bash
git add -p  # nothing new to stage — all changes were committed per task
git commit --allow-empty -m "chore: portrait generation complete (564 heroes)"
```

---

## Appendix: Retry failed heroes

If some heroes failed, re-run the script — it skips heroes that already have `portrait_url` set. To see which heroes are still missing:

```sql
SELECT id, name, image_url FROM heroes
WHERE portrait_url IS NULL AND image_url IS NOT NULL
ORDER BY name;
```
