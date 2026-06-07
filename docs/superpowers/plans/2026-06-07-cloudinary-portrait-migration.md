# Cloudinary Portrait Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app's 1,266 hero portraits off Supabase Storage onto Cloudinary, serving context-sized, auto-compressed, auto-format derivatives from full-quality masters.

**Architecture:** App-side, the two image-source functions in `src/constants/heroImages.ts` inject `f_auto,q_auto,w_<N>` into Cloudinary URLs (and leave all other URLs untouched). A one-time, resumable bun script backs up each original locally, uploads it to Cloudinary, then flips that hero's `portrait_url` to the Cloudinary URL — so rows migrate individually with no broken intermediate state.

**Tech Stack:** TypeScript, bun (script runner, matching existing `scripts/*.ts`), `cloudinary` Node SDK, `@supabase/supabase-js`, `p-limit`, `dotenv`, Jest.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/constants/heroImages.ts` | Add `withCloudinaryTransform`; wire into the two source functions |
| Modify | `__tests__/lib/heroImages.test.ts` | Unit tests for the transform + wiring |
| Modify | `.env.example` | Document `CLOUDINARY_*` keys (placeholders) |
| Create | `scripts/migrate-portraits-to-cloudinary.ts` | One-off backup → upload → DB flip, resumable |

Note: `.env.local` (gitignored) holds the real `CLOUDINARY_*` values and is edited during execution, not committed. The `cloudinary` dependency is already installed (devDependency).

---

## Task 1: Cloudinary URL Transform Helper

**Files:**
- Modify: `src/constants/heroImages.ts`
- Test: `__tests__/lib/heroImages.test.ts`

This task is a safe no-op for all existing (Supabase/CDN/external) URLs — only Cloudinary URLs change. It can land before any data migration.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/lib/heroImages.test.ts` (and add the import for the new symbols on line 2):

Change line 2 from:

```ts
import { heroImageSource } from '../../src/constants/heroImages';
```

to:

```ts
import {
  heroImageSource,
  heroGridImageSource,
  withCloudinaryTransform,
} from '../../src/constants/heroImages';
```

Then append this suite to the end of the file:

```ts
describe('withCloudinaryTransform', () => {
  const CLOUDINARY =
    'https://res.cloudinary.com/dgrsb5o4p/image/upload/v1780861911/hero-portraits/269.jpg';

  it('injects f_auto,q_auto,w_<width> after /upload/ for Cloudinary URLs', () => {
    expect(withCloudinaryTransform(CLOUDINARY, 900)).toBe(
      'https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_900/v1780861911/hero-portraits/269.jpg',
    );
  });

  it('leaves a Supabase URL unchanged', () => {
    const supabase =
      'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/269.jpg';
    expect(withCloudinaryTransform(supabase, 900)).toBe(supabase);
  });

  it('leaves the akabab CDN URL unchanged', () => {
    const cdn = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md/620.jpg';
    expect(withCloudinaryTransform(cdn, 600)).toBe(cdn);
  });

  it('leaves an empty string unchanged', () => {
    expect(withCloudinaryTransform('', 900)).toBe('');
  });
});

describe('Cloudinary wiring', () => {
  const CLOUDINARY_BASE =
    'https://res.cloudinary.com/dgrsb5o4p/image/upload/v1780861911/hero-portraits/269.jpg';

  it('heroImageSource adds w_900 to a Cloudinary portrait', () => {
    expect(heroImageSource('269', null, CLOUDINARY_BASE)).toEqual({
      uri: 'https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_900/v1780861911/hero-portraits/269.jpg',
    });
  });

  it('heroGridImageSource adds w_600 to a Cloudinary portrait', () => {
    expect(heroGridImageSource('269', null, CLOUDINARY_BASE, null)).toEqual({
      uri: 'https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_600/v1780861911/hero-portraits/269.jpg',
    });
  });

  it('heroImageSource leaves a non-Cloudinary portrait untouched', () => {
    const supabase =
      'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/269.jpg';
    expect(heroImageSource('269', null, supabase)).toEqual({ uri: supabase });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test:ci --testPathPattern="heroImages"`
Expected: FAIL — `withCloudinaryTransform` is not exported (and the wiring assertions fail).

- [ ] **Step 3: Implement the helper and wire it in**

Replace the entire contents of `src/constants/heroImages.ts` with:

```ts
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md';

// Cloud name is public — it appears in every Cloudinary delivery URL.
const CLOUDINARY_CLOUD = 'dgrsb5o4p';
const CLOUDINARY_MARKER = `res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/`;

// Delivered widths per context. q_auto handles compression; f_auto handles format.
const DETAIL_WIDTH = 900; // detail screens, banners, carousels
const GRID_WIDTH = 600; // grid / thumbnail cards (sharp on retina)

// CDN only has images for numeric SuperheroAPI IDs — ComicVine (cv-*) IDs will 404.
const isNumericId = (id: string | number) => /^\d+$/.test(String(id));

// Some ingested rows point at a "no image" placeholder (ComicVine's blank.png or
// the akabab no-portrait). Treat those as missing so cards fall back to their own
// empty/initial treatment instead of rendering a broken-looking grey placeholder.
const isPlaceholder = (url?: string | null): boolean =>
  !!url && (url.includes('blank.png') || url.includes('no-portrait'));

const realUrl = (url?: string | null): string | null =>
  url && url.startsWith('http') && !isPlaceholder(url) ? url : null;

/**
 * Inject f_auto,q_auto,w_<width> into a Cloudinary delivery URL's /upload/ segment.
 * Non-Cloudinary URLs (Supabase, akabab CDN, external) are returned unchanged.
 */
export function withCloudinaryTransform(url: string, width: number): string {
  if (!url.includes(CLOUDINARY_MARKER)) return url;
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const insertAt = i + marker.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,w_${width}/${url.slice(insertAt)}`;
}

/**
 * Full-resolution source for detail screens, featured panels, and carousels.
 * Priority: Supabase portrait → external URL → CDN (numeric IDs only)
 */
export function heroImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
): { uri: string } {
  const uri =
    realUrl(portraitUrl) ?? realUrl(imageUrl) ?? (isNumericId(id) ? `${CDN_BASE}/${id}.jpg` : '');
  return { uri: withCloudinaryTransform(uri, DETAIL_WIDTH) };
}

/**
 * Grid card source — uses the medium image URL for smaller thumbnails,
 * falling back to the same priority chain as heroImageSource.
 */
export function heroGridImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
  imageMdUrl?: string | null,
): { uri: string } {
  const uri =
    realUrl(portraitUrl) ??
    realUrl(imageMdUrl) ??
    realUrl(imageUrl) ??
    (isNumericId(id) ? `${CDN_BASE}/${id}.jpg` : '');
  return { uri: withCloudinaryTransform(uri, GRID_WIDTH) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test:ci --testPathPattern="heroImages"`
Expected: PASS (existing 6 + new cases).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: tsc exits 0; all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/constants/heroImages.ts __tests__/lib/heroImages.test.ts
git commit -m "feat(images): inject Cloudinary f_auto/q_auto/width transforms"
```

---

## Task 2: Environment Configuration

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add Cloudinary keys to `.env.example`**

Append these lines to `.env.example`:

```sh
# Cloudinary — used by scripts/migrate-portraits-to-cloudinary.ts (server-side only)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

- [ ] **Step 2: Add the real values to `.env.local` (gitignored — not committed)**

Add the three `CLOUDINARY_*` keys to `.env.local` with the project's real Cloudinary
credentials. Do **not** paste the secret into any committed file. The values are
already present in the gitignored `scripts/cloudinary-onboarding.js` (cloud name
`dgrsb5o4p`, plus the API key and secret) — copy them from there, or ask the user /
read them from the Cloudinary console:

```sh
CLOUDINARY_CLOUD_NAME=dgrsb5o4p
CLOUDINARY_API_KEY=<from scripts/cloudinary-onboarding.js or Cloudinary console>
CLOUDINARY_API_SECRET=<from scripts/cloudinary-onboarding.js or Cloudinary console>
```

Verify it is ignored:

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (confirming it will not be committed).

- [ ] **Step 3: Commit (only the example)**

```bash
git add .env.example
git commit -m "chore(env): document Cloudinary keys in .env.example"
```

---

## Task 3: Migration Script

**Files:**
- Create: `scripts/migrate-portraits-to-cloudinary.ts`

This is a one-off operational script. Its safety check is `--dry-run`, not unit tests (it does network + filesystem + DB I/O).

- [ ] **Step 1: Write the script**

Create `scripts/migrate-portraits-to-cloudinary.ts`:

```ts
#!/usr/bin/env bun
/**
 * Migrate Supabase-hosted hero portraits to Cloudinary.
 *
 * For each hero whose portrait_url points at Supabase Storage:
 *   1. Download the original to ./portrait-backup/{id}.jpg (local safety net).
 *   2. Upload to Cloudinary public_id `hero-portraits/{id}` (overwrite:false).
 *   3. Flip heroes.portrait_url to the returned Cloudinary secure_url.
 *
 * Idempotent + resumable: existing backup files and already-Cloudinary rows are
 * skipped, so re-running continues where it left off. Rows flip individually, so
 * there is no broken intermediate state.
 *
 * Usage:
 *   bun scripts/migrate-portraits-to-cloudinary.ts --dry-run            # preview
 *   bun scripts/migrate-portraits-to-cloudinary.ts --limit 10           # first 10
 *   bun scripts/migrate-portraits-to-cloudinary.ts --concurrency 8      # full run
 */
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import pLimit from 'p-limit';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) {
  console.error(
    'Missing env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
  );
  process.exit(1);
}

cloudinary.config({ cloud_name: CLOUD_NAME, api_key: CLOUD_KEY, api_secret: CLOUD_SECRET });
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const arg = (flag: string): string | null =>
  process.argv.includes(flag) ? (process.argv[process.argv.indexOf(flag) + 1] ?? null) : null;
const has = (flag: string) => process.argv.includes(flag);

const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : Infinity;
const CONCURRENCY = arg('--concurrency') ? parseInt(arg('--concurrency')!, 10) : 8;
const DRY_RUN = has('--dry-run');

const BACKUP_DIR = './portrait-backup';

type Row = { id: string; portrait_url: string };

/** Page through every Supabase-hosted portrait (table exceeds the 1000-row cap). */
async function fetchAllRows(): Promise<Row[]> {
  const PAGE = 1000;
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('heroes')
      .select('id, portrait_url')
      .like('portrait_url', '%supabase.co/storage%')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return all;
}

async function backup(id: string, url: string): Promise<void> {
  const path = `${BACKUP_DIR}/${id}.jpg`;
  if (existsSync(path)) return; // resumable: already backed up
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
}

async function migrate(row: Row): Promise<'migrated' | 'failed'> {
  try {
    await backup(row.id, row.portrait_url);
    // overwrite:false → if the asset already exists, Cloudinary returns it (no re-upload).
    const result = await cloudinary.uploader.upload(`${BACKUP_DIR}/${row.id}.jpg`, {
      public_id: `hero-portraits/${row.id}`,
      overwrite: false,
    });
    const { error } = await sb
      .from('heroes')
      .update({ portrait_url: result.secure_url })
      .eq('id', row.id);
    if (error) throw new Error(`db: ${error.message}`);
    return 'migrated';
  } catch (err) {
    console.error(`  ✗ ${row.id}:`, err instanceof Error ? err.message : err);
    return 'failed';
  }
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const rows = (await fetchAllRows()).slice(0, LIMIT);
  console.log(`Found ${rows.length} Supabase-hosted portraits to migrate.`);

  if (DRY_RUN) {
    console.log('DRY RUN — no downloads, uploads, or DB writes.');
    rows.slice(0, 5).forEach((r) => console.log(`  would migrate ${r.id} ← ${r.portrait_url}`));
    console.log(`… and ${Math.max(0, rows.length - 5)} more.`);
    return;
  }

  const limit = pLimit(CONCURRENCY);
  let migrated = 0;
  let failed = 0;
  let done = 0;
  const failedIds: string[] = [];

  await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const outcome = await migrate(row);
        done += 1;
        if (outcome === 'migrated') migrated += 1;
        else {
          failed += 1;
          failedIds.push(row.id);
        }
        if (done % 50 === 0 || done === rows.length) {
          console.log(`  ${done} of ${rows.length} (migrated ${migrated}, failed ${failed})`);
        }
      }),
    ),
  );

  console.log(`\nDone. Migrated ${migrated}, failed ${failed}.`);
  if (failedIds.length) console.log('Failed ids:', failedIds.join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck the script**

Run: `yarn tsc --noEmit`
Expected: exits 0 (no type errors introduced).

- [ ] **Step 3: Dry run**

Run: `bun scripts/migrate-portraits-to-cloudinary.ts --dry-run`
Expected: prints `Found 1266 Supabase-hosted portraits to migrate.`, then `DRY RUN …` and 5 sample lines whose URLs contain `supabase.co/storage`. No `portrait-backup/` files created, no DB change.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-portraits-to-cloudinary.ts
git commit -m "feat(scripts): add Cloudinary portrait migration script"
```

---

## Task 4: Execute the Migration (operational)

**Files:** none (runs the Task 3 script against live data).

- [ ] **Step 1: Migrate a small batch first**

Run: `bun scripts/migrate-portraits-to-cloudinary.ts --limit 10`
Expected: `Done. Migrated 10, failed 0.` (or a short failed-ids list). `./portrait-backup/` now holds 10 `.jpg` files.

- [ ] **Step 2: Verify the batch in the DB**

Run:
```bash
bun -e "import {createClient} from '@supabase/supabase-js'; import 'dotenv/config'; const sb=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY); const {count}=await sb.from('heroes').select('*',{count:'exact',head:true}).like('portrait_url','%cloudinary%'); console.log('cloudinary rows:', count);"
```
Expected: `cloudinary rows: 10` (or however many the batch migrated).

- [ ] **Step 3: Spot-check one delivered image**

Open one migrated `portrait_url` in a browser with `f_auto,q_auto,w_900` injected after `/upload/`, e.g.:
`https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_900/v…/hero-portraits/<id>.jpg`
Expected: the portrait loads, smaller than the original and served as WebP/AVIF on a modern browser.

- [ ] **Step 4: Run the full migration**

Run: `bun scripts/migrate-portraits-to-cloudinary.ts --concurrency 8`
Expected: progresses in `N of 1266` increments to `Done. Migrated ~1266, failed 0.` Re-run once if any failed (it resumes and retries only the un-flipped rows).

- [ ] **Step 5: Confirm zero Supabase-hosted portraits remain**

Run:
```bash
bun -e "import {createClient} from '@supabase/supabase-js'; import 'dotenv/config'; const sb=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY); const {count}=await sb.from('heroes').select('*',{count:'exact',head:true}).like('portrait_url','%supabase.co/storage%'); console.log('remaining supabase portraits:', count);"
```
Expected: `remaining supabase portraits: 0`.

- [ ] **Step 6: Verify in the running app (iOS + web)**

Start the app (`yarn start`) and confirm portraits load on the Discover grid, a character detail screen, and search — on both a native target and web. They should look correct and load quickly.

---

## Task 5: Delete the Supabase Bucket (operational, user-gated)

**Files:** none.

Do this only after Task 4 Step 6 passes and the user confirms. This is the step that drops storage under quota; it is irreversible (the local `./portrait-backup/` and Cloudinary remain as backups).

- [ ] **Step 1: Get explicit user confirmation**

Confirm with the user that portraits load correctly in the app and they want the `hero-portraits` Supabase bucket deleted.

- [ ] **Step 2: Empty and delete the bucket**

In the Supabase dashboard (Storage → `hero-portraits`): delete all objects, then delete the bucket. (Or via the management API if preferred.)

- [ ] **Step 3: Verify storage dropped**

In the Supabase dashboard usage page, confirm Storage Size has dropped from ~933 MB toward ~0 for that bucket, bringing the org back under the 1 GB free-tier quota.

- [ ] **Step 4: Final app check**

Reload the app and confirm portraits still load (now exclusively from Cloudinary) on native and web.
```
