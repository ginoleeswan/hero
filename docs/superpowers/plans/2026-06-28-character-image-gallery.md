# Character Image Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-source character image gallery to the character info page, sourced from ComicVine now (the character's own image + cover art) on a data model built to absorb AI/curated sources later.

**Architecture:** A normalized `hero_images` table (one row per image, idempotent on `(hero_id, url)`) replaces the cover-only `heroes.issue_covers` jsonb in the read path. The `get-hero-gallery` edge function writes rows; a new `getHeroImages` db module reads them; `useHeroDetail` exposes `galleryImages` to both platform views, which render it through the existing `GalleryStrip` + `ImageLightbox`.

**Tech Stack:** Supabase (Postgres + RLS + Deno edge functions), Expo / React Native, TypeScript, Jest.

## Global Constraints

- Package manager: **yarn** only (never npm/bun).
- TypeScript throughout — no `any`; `unknown` for caught errors.
- Screens never import `supabase` directly — all DB access via `src/lib/db/`.
- New Supabase tables auto-enable RLS; **must add a public-read (anon `select`) policy** or anon reads return 0 rows silently.
- Migrations: new file `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, applied via `mcp__supabase__apply_migration`, then regenerate `src/types/database.generated.ts` via `mcp__supabase__generate_typescript_types` (never edit by hand).
- PostgREST has a 1000-row cap — always `.limit()`/`.range()` on large reads (per-hero image reads are small, but the rule stands).
- `heroes.id` is `text` (mixed `h_`, `cv-`, numeric id schemes).
- Issue read-through route is `/issue/cvi:<issueId>` (note the `cvi:` prefix).
- Tests live in `__tests__/` mirroring `src/`; run with `yarn test:ci`. Don't test navigation/full-screen render.

---

### Task 1: Create `hero_images` table + backfill

**Files:**
- Create: `supabase/migrations/20260628120000_hero_images.sql`
- Modify: `src/types/database.generated.ts` (regenerated, not hand-edited)

**Interfaces:**
- Produces: table `hero_images(id uuid, hero_id text, url text, source text, caption text, issue_id text, sort_order int, created_at timestamptz)` with `unique(hero_id, url)` and a public-read RLS policy.

- [ ] **Step 1: Write the migration SQL**

```sql
-- hero_images: one row per character image, multi-source (ComicVine now;
-- AI/curated later). Replaces heroes.issue_covers in the read path.
create table public.hero_images (
  id          uuid primary key default gen_random_uuid(),
  hero_id     text not null references public.heroes(id) on delete cascade,
  url         text not null,
  source      text not null,            -- 'comicvine_primary' | 'comicvine_cover' | 'ai' | 'curated'
  caption     text,
  issue_id    text,                     -- set for covers → /issue/cvi:<id> read-through
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (hero_id, url)
);

create index hero_images_hero_id_idx on public.hero_images (hero_id, sort_order);

alter table public.hero_images enable row level security;

create policy "hero_images public read"
  on public.hero_images for select
  to anon, authenticated
  using (true);

-- One-time backfill of existing covers. sort_order = index + 1 leaves 0 for the
-- ComicVine primary image the edge fn will add later. Idempotent via the unique
-- constraint.
insert into public.hero_images (hero_id, url, source, caption, issue_id, sort_order)
select
  h.id,
  cover->>'url',
  'comicvine_cover',
  cover->>'name',
  cover->>'id',
  (ord::int) + 1
from public.heroes h
cross join lateral jsonb_array_elements(h.issue_covers) with ordinality as t(cover, ord)
where h.issue_covers is not null
  and jsonb_typeof(h.issue_covers) = 'array'
  and cover->>'url' is not null
on conflict (hero_id, url) do nothing;
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with name `hero_images` and the SQL above.
Expected: success, no error.

- [ ] **Step 3: Verify table + backfill**

Run via `mcp__supabase__execute_sql`:
```sql
select count(*) as rows, count(distinct hero_id) as heroes from public.hero_images;
```
Expected: rows > 0 (matches total covers previously in `issue_covers`).

- [ ] **Step 4: Verify RLS read policy exists**

Run via `mcp__supabase__execute_sql`:
```sql
select polname from pg_policy where polrelid = 'public.hero_images'::regclass;
```
Expected: `hero_images public read` listed.

- [ ] **Step 5: Regenerate types**

Run `mcp__supabase__generate_typescript_types` and write the result to `src/types/database.generated.ts`.
Expected: `hero_images` Row/Insert/Update types present.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260628120000_hero_images.sql src/types/database.generated.ts
git commit -m "feat(db): hero_images table + backfill from issue_covers"
```

---

### Task 2: `getHeroImages` data module

**Files:**
- Create: `src/lib/db/heroImages.ts`
- Modify: `src/types/index.ts` (add `HeroImage` type)
- Test: `__tests__/lib/db/heroImages.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase`; `hero_images` table from Task 1.
- Produces:
  ```ts
  export interface HeroImage {
    url: string;
    caption: string | null;
    source: string;
    issueId: string | null;
  }
  export async function getHeroImages(heroId: string): Promise<HeroImage[]>;
  ```

- [ ] **Step 1: Add the `HeroImage` type**

In `src/types/index.ts`, after the `IssueCover` interface (currently ending ~line 115), add:
```ts
export interface HeroImage {
  url: string;
  caption: string | null;
  /** 'comicvine_primary' | 'comicvine_cover' | 'ai' | 'curated' */
  source: string;
  /** ComicVine issue id (covers only) → opens /issue/cvi:<id> read-through. */
  issueId: string | null;
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/lib/db/heroImages.test.ts` (mirrors the `viewHistory.test.ts` mock style):
```ts
import { getHeroImages } from '../../../src/lib/db/heroImages';

let mockResolvers: Record<string, { data: unknown; error: unknown }> = {};

jest.mock('../../../src/lib/supabase', () => {
  const makeChain = (tableName: string) => {
    const methods = ['select', 'eq', 'order'];
    const c: Record<string, unknown> = {};
    methods.forEach((m) => {
      c[m] = jest.fn().mockReturnValue(c);
    });
    c.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }).then(resolve);
    return c;
  };
  const chains: Record<string, ReturnType<typeof makeChain>> = {};
  const mockFrom = jest.fn().mockImplementation((tableName: string) => {
    if (!chains[tableName]) chains[tableName] = makeChain(tableName);
    return chains[tableName];
  });
  return { supabase: { from: mockFrom }, __chains: chains, __mockFrom: mockFrom };
});

const { __chains: chains, __mockFrom: mockFrom } = jest.requireMock(
  '../../../src/lib/supabase',
) as {
  __chains: Record<string, Record<string, jest.Mock>>;
  __mockFrom: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockResolvers = {};
  Object.values(chains).forEach((c) => {
    ['select', 'eq', 'order'].forEach((m) => c[m].mockReturnValue(c));
  });
  mockFrom.mockImplementation((tableName: string) => {
    if (!chains[tableName]) {
      const methods = ['select', 'eq', 'order'];
      const c: Record<string, unknown> = {};
      methods.forEach((m) => (c[m] = jest.fn().mockReturnValue(c)));
      chains[tableName] = c as Record<string, jest.Mock>;
    }
    return chains[tableName];
  });
});

test('maps rows to HeroImage and preserves DB order', async () => {
  mockResolvers['hero_images'] = {
    data: [
      { url: 'a.jpg', caption: 'Hero', source: 'comicvine_primary', issue_id: null },
      { url: 'b.jpg', caption: 'Issue 1', source: 'comicvine_cover', issue_id: '4000-1' },
    ],
    error: null,
  };
  const result = await getHeroImages('h_x');
  expect(result).toEqual([
    { url: 'a.jpg', caption: 'Hero', source: 'comicvine_primary', issueId: null },
    { url: 'b.jpg', caption: 'Issue 1', source: 'comicvine_cover', issueId: '4000-1' },
  ]);
  expect(chains['hero_images'].eq).toHaveBeenCalledWith('hero_id', 'h_x');
  expect(chains['hero_images'].order).toHaveBeenCalledWith('sort_order', { ascending: true });
});

test('returns [] on error', async () => {
  mockResolvers['hero_images'] = { data: null, error: { message: 'boom' } };
  expect(await getHeroImages('h_x')).toEqual([]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/heroImages.test.ts`
Expected: FAIL — cannot find module `src/lib/db/heroImages`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/db/heroImages.ts`:
```ts
import { supabase } from '../supabase';
import type { HeroImage } from '../../types';

/** All gallery images for a hero, ordered (primary image first, then covers). */
export async function getHeroImages(heroId: string): Promise<HeroImage[]> {
  const { data, error } = await supabase
    .from('hero_images')
    .select('url, caption, source, issue_id')
    .eq('hero_id', heroId)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[getHeroImages] error:', error.message);
    return [];
  }
  return data.map((r) => ({
    url: r.url,
    caption: r.caption,
    source: r.source,
    issueId: r.issue_id,
  }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/heroImages.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/heroImages.ts src/types/index.ts __tests__/lib/db/heroImages.test.ts
git commit -m "feat(db): getHeroImages reader + HeroImage type"
```

---

### Task 3: Rewrite `get-hero-gallery` edge function to write `hero_images`

**Files:**
- Modify: `supabase/functions/get-hero-gallery/index.ts`

**Interfaces:**
- Consumes: `hero_images` table (Task 1); ComicVine character `image` + `issue_credits`.
- Produces: inserts `comicvine_primary` (sort 0) + `comicvine_cover` (sort 1..N) rows; sets `heroes.gallery_enriched_at`. Returns `{ ok: true }`.

- [ ] **Step 1: Replace the function body**

Replace the entire `serve(...)` body in `supabase/functions/get-hero-gallery/index.ts` with the version below (keeps imports/CORS/`json` helper above it). Note `supabase/functions/**` is excluded from JS tooling, so no lint/type gate applies here — verify by invocation.

```ts
const OK = { ok: true };
const FAIL = { ok: false };

interface ImageRow {
  hero_id: string;
  url: string;
  source: string;
  caption: string | null;
  issue_id: string | null;
  sort_order: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId, comicvineId } = (await req.json()) as {
      heroId: string;
      comicvineId: string;
    };
    if (!heroId || !comicvineId) {
      return json({ error: 'heroId and comicvineId required' }, 400);
    }

    const numericId = comicvineId.replace(/^4005-/, '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // One character call: primary image + every issue credit ({id, name, api_detail_url}).
    const charParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      field_list: 'image,issue_credits',
    });
    const charRes = await fetch(`${COMICVINE_BASE}/character/4005-${numericId}/?${charParams}`);
    const charJson = charRes.ok ? await charRes.json() : {};
    const results = charJson.results ?? {};

    const rows: ImageRow[] = [];

    // Primary character image → the lead "artwork of the character".
    const primaryUrl: string | null =
      ((results.image as Record<string, unknown>)?.super_url as string) ??
      ((results.image as Record<string, unknown>)?.original_url as string) ??
      null;
    if (primaryUrl) {
      rows.push({
        hero_id: heroId,
        url: primaryUrl,
        source: 'comicvine_primary',
        caption: null,
        issue_id: null,
        sort_order: 0,
      });
    }

    // Cover art from the first 40 appearances.
    const credits: Array<Record<string, unknown>> = Array.isArray(results.issue_credits)
      ? results.issue_credits
      : [];
    const first40 = credits.slice(0, 40);
    const covers = await Promise.all(
      first40.map(async (credit, i) => {
        const apiDetailUrl =
          typeof credit.api_detail_url === 'string' ? credit.api_detail_url : null;
        if (!apiDetailUrl) return null;
        try {
          const params = new URLSearchParams({
            api_key: COMICVINE_API_KEY,
            format: 'json',
            field_list: 'image,name,issue_number,cover_date',
          });
          const res = await fetch(`${apiDetailUrl}?${params}`);
          if (!res.ok) return null;
          const data = (await res.json()).results ?? {};
          const img = data.image as Record<string, unknown> | undefined;
          const url: string | null =
            ((img?.original_url as string) ?? (img?.medium_url as string)) ?? null;
          if (!url) return null;
          return {
            hero_id: heroId,
            url,
            source: 'comicvine_cover',
            caption: typeof data.name === 'string' ? data.name : null,
            issue_id: credit.id != null ? String(credit.id) : null,
            sort_order: i + 1,
          } as ImageRow;
        } catch {
          return null;
        }
      }),
    );
    for (const c of covers) if (c) rows.push(c);

    if (rows.length > 0) {
      await supabase.from('hero_images').upsert(rows, {
        onConflict: 'hero_id,url',
        ignoreDuplicates: true,
      });
    }

    // Sentinel so this runs once per hero, even when there were no images.
    await supabase
      .from('heroes')
      .update({ gallery_enriched_at: new Date().toISOString() })
      .eq('id', heroId);

    return json(OK);
  } catch (err) {
    console.error('[get-hero-gallery]', err);
    return json(FAIL, 500);
  }
});
```

- [ ] **Step 2: Deploy the function**

Use `mcp__supabase__deploy_edge_function` for `get-hero-gallery` with the updated file.
Expected: deploy success.

- [ ] **Step 3: Reset one hero's sentinel and invoke to verify writes**

Pick a known ComicVine hero (has `comicvine_id`). Via `mcp__supabase__execute_sql`:
```sql
update public.heroes set gallery_enriched_at = null
where comicvine_id is not null and id = '<test_hero_id>';
delete from public.hero_images where hero_id = '<test_hero_id>';
```
Then invoke the function (Supabase dashboard or `supabase functions invoke`) with body
`{"heroId":"<test_hero_id>","comicvineId":"<that hero's comicvine_id>"}`.
Expected response: `{"ok":true}`.

- [ ] **Step 4: Confirm rows written**

Via `mcp__supabase__execute_sql`:
```sql
select source, count(*), min(sort_order), max(sort_order)
from public.hero_images where hero_id = '<test_hero_id>' group by source;
```
Expected: a `comicvine_primary` row at sort_order 0 (if the character had an image) and `comicvine_cover` rows from 1 upward.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/get-hero-gallery/index.ts
git commit -m "feat(edge): get-hero-gallery writes hero_images (primary + covers)"
```

---

### Task 4: Wire `useHeroDetail` to `galleryImages`

**Files:**
- Modify: `src/lib/api.ts:210-225` (`fetchHeroGallery`)
- Modify: `src/hooks/useHeroDetail.ts`

**Interfaces:**
- Consumes: `getHeroImages` (Task 2); `fetchHeroGallery` trigger.
- Produces: hook returns `galleryImages: HeroImage[] | null` and `galleryLoading: boolean` (replacing `issueCovers`).

- [ ] **Step 1: Simplify `fetchHeroGallery` to a fire-and-refetch trigger**

In `src/lib/api.ts`, replace the `fetchHeroGallery` function (lines ~210-225) with:
```ts
/** Triggers the gallery enrich edge fn. Images are read separately via
 *  getHeroImages once this resolves. */
export async function fetchHeroGallery(heroId: string, comicvineId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('get-hero-gallery', {
    body: { heroId, comicvineId },
  });
  if (error) console.warn('[fetchHeroGallery] error:', error.message, error);
}
```
If `IssueCover` is now unused in `api.ts`, remove it from the import on line 3.

- [ ] **Step 2: Update the hook imports and state**

In `src/hooks/useHeroDetail.ts`:
- Add to imports: `import { getHeroImages } from '../lib/db/heroImages';` and add `HeroImage` to the type import from `'../types'` (line 28 currently imports `CharacterData, IssueCover`).
- Replace the state declaration `const [issueCovers, setIssueCovers] = useState<IssueCover[] | null>(null);` (line ~70) with:
```ts
const [galleryImages, setGalleryImages] = useState<HeroImage[] | null>(null);
```
- `IssueCover` may now be unused in the hook — drop it from the import if so.

- [ ] **Step 3: Replace the gallery load block**

In the `plan === 'render-row'` branch, replace the existing seed + lazy-fetch block (the `if (heroRow.issue_covers) {...}` seed and the `const needsGallery = ...` block, lines ~238-255) with:
```ts
      // Gallery images (primary art + covers, multi-source) from hero_images.
      getHeroImages(heroRow.id)
        .then((imgs) => {
          if (imgs.length > 0) setGalleryImages(imgs);
        })
        .catch(() => {});

      // First-ever fetch: enrich from ComicVine, then re-read the rows.
      const needsGallery = heroRow.comicvine_id != null && heroRow.gallery_enriched_at === null;
      if (needsGallery) {
        setGalleryLoading(true);
        fetchHeroGallery(heroRow.id, heroRow.comicvine_id!)
          .then(() => getHeroImages(heroRow.id))
          .then((imgs) => {
            if (imgs.length > 0) setGalleryImages(imgs);
          })
          .catch(() => {})
          .finally(() => setGalleryLoading(false));
      }
```

- [ ] **Step 4: Update the return object**

In the returned object (lines ~439-440), replace `issueCovers,` with `galleryImages,` (keep `galleryLoading,`).

- [ ] **Step 5: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors referencing `useHeroDetail.ts` or `api.ts`. (Pre-existing unrelated warnings/errors elsewhere are out of scope.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/hooks/useHeroDetail.ts
git commit -m "feat(hooks): useHeroDetail exposes galleryImages from hero_images"
```

---

### Task 5: Render the Gallery section on both screens

**Files:**
- Modify: `app/character/[id].web.tsx` (gallery block ~1362-1387; hook destructure ~605; lightbox state)
- Modify: `app/character/[id].tsx` (gallery block ~1373; hook destructure ~605; print-section visibility condition ~1371-1374)

**Interfaces:**
- Consumes: `galleryImages` (Task 4); existing `GalleryStrip`, `ImageLightbox`.

- [ ] **Step 1 (web): swap the destructured value**

In `app/character/[id].web.tsx`, in the `useHeroDetail` destructure, replace `issueCovers,` with `galleryImages,`.

- [ ] **Step 2 (web): replace the cover-gallery block**

Replace the "Cover gallery" block (lines ~1362-1387) with one driven by `galleryImages`. An image with `issueId` opens the issue read-through; otherwise the lightbox:
```tsx
                        {/* Gallery — character art + covers (multi-source) */}
                        {galleryImages && galleryImages.length > 0 ? (
                          <View style={styles.inPrintGallery}>
                            <Text style={styles.inPrintGalleryLabel}>
                              Gallery · {galleryImages.length}
                            </Text>
                            <View style={{ marginRight: -20 }}>
                              <GalleryStrip
                                images={galleryImages.map((g) => ({ url: g.url, caption: g.caption }))}
                                onPress={(i) => {
                                  const issueId = galleryImages[i]?.issueId;
                                  if (issueId) {
                                    router.push(
                                      `/issue/cvi:${issueId}` as Parameters<typeof router.push>[0],
                                    );
                                    return;
                                  }
                                  setLightboxImages(
                                    galleryImages.map((g) => ({ url: g.url, caption: g.caption })),
                                  );
                                  setLightboxIndex(i);
                                }}
                              />
                            </View>
                          </View>
                        ) : null}
```

- [ ] **Step 3 (native): swap the destructured value**

In `app/character/[id].tsx`, in the `useHeroDetail` destructure (line ~605), replace `issueCovers,` with `galleryImages,`.

- [ ] **Step 4 (native): update the In-Print visibility condition**

Replace the two `issueCovers` references in the section-visibility condition (lines ~1371-1374):
```tsx
              {newIssues.length > 0 ||
              hasFirstVisual ||
              (galleryImages && galleryImages.length > 0) ||
              (galleryImages === null && galleryLoading) ? (
```

- [ ] **Step 5 (native): replace the native cover-gallery block**

Find the native `GalleryStrip` usage (the block rendering `issueCovers` further down in the In-Print section) and replace its `issueCovers` references with `galleryImages` the same way as web — `images={galleryImages.map((g) => ({ url: g.url, caption: g.caption }))}`, and in `onPress` read `galleryImages[i]?.issueId`, routing to `/issue/cvi:${issueId}` when present else setting the lightbox from `galleryImages`. Update its count label from `issueCovers.length` to `galleryImages.length`.

- [ ] **Step 6: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors referencing the two `character/[id]` files.

- [ ] **Step 7: Run the full test suite**

Run: `yarn test:ci`
Expected: PASS (including the new `heroImages.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add app/character/[id].web.tsx app/character/[id].tsx
git commit -m "feat(character): unified Gallery section from hero_images"
```

---

## Self-Review

**Spec coverage:**
- §1 data model → Task 1. ✓
- §2 backfill → Task 1 Step 1 (insert…select). ✓
- §3 edge fn rewrite (primary image, higher-res, cap 40, ON CONFLICT) → Task 3. ✓
- §4 db layer (`getHeroImages`, `HeroImage`) → Task 2. ✓
- §5 hook (`galleryImages`, sentinel-gated enrich then re-read) → Task 4. ✓
- §6 UI standalone Gallery on both platforms, tap behaviour preserved → Task 5. ✓
- §7 testing (`getHeroImages` unit test; no edge/render tests) → Task 2. ✓

**Type consistency:** `HeroImage { url, caption, source, issueId }` defined in Task 2, consumed identically in Tasks 4–5. Edge fn writes snake_case columns (`issue_id`); `getHeroImages` maps `issue_id → issueId`. `fetchHeroGallery` returns `Promise<void>` in Task 4 and is awaited (not destructured) — consistent.

**Placeholder scan:** none — every code step shows full content; `<test_hero_id>` in Task 3 is an intentional runtime value chosen at execution, not a code placeholder.

**Note for executor:** the legacy `heroes.issue_covers` column is intentionally left in place (no longer read). Do not drop it in this plan.
