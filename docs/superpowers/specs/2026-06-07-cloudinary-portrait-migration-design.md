# Cloudinary Portrait Migration Design

## Overview

Move the app's 1,266 hero portrait images off Supabase Storage (currently 933 MB / 1 GB, 96% of the free-tier quota) onto Cloudinary, which stores full-quality masters and serves context-sized, auto-compressed, auto-format versions on the fly. This frees the Supabase bucket and improves delivery (smaller images, WebP/AVIF, edge-cached) without sacrificing source quality.

## Goals & Constraints

- **Get under the Supabase storage quota** (grace deadline: 5 Jul 2026).
- **Preserve quality** — Cloudinary keeps full-res masters; the app requests resized derivatives.
- **No broken state** during migration (phased, per-row cutover).
- **Local backup** of all originals before any deletion.

## Current State

- 2,950 heroes total; **1,266 have a `portrait_url`**, all hosted on Supabase Storage as `hero-portraits/{id}.jpg` (filename = hero id, e.g. `269.jpg`, `cv-1277.jpg`).
- The other ~1,684 heroes have no `portrait_url` and fall back to `image_url` / `image_md_url` / the akabab CDN — **not affected** by this work.
- Nearly all image consumers route through two functions in `src/constants/heroImages.ts`:
  - `heroImageSource(id, imageUrl?, portraitUrl?)` — detail screens, banners, carousels.
  - `heroGridImageSource(id, imageUrl?, portraitUrl?, imageMdUrl?)` — grid/thumbnail cards.
- Cloudinary account is set up and verified (cloud name `dgrsb5o4p`).

## Data Model Decision

**No new column.** `portrait_url` is overwritten per-hero, but only *after* that hero's Cloudinary upload succeeds. At any instant a row is either:

- still a Supabase URL (not yet migrated — still works), or
- a Cloudinary base URL (migrated — works).

There is never a broken intermediate state. Unmigrated heroes keep serving from Supabase until their turn — this is the "fallback." Rollback is trivial: Supabase URLs are deterministic (`.../hero-portraits/{id}.jpg`) and can be reconstructed from the id.

The stored Cloudinary value is the **delivery base URL** (no transforms baked in), e.g.:

```
https://res.cloudinary.com/dgrsb5o4p/image/upload/hero-portraits/269.jpg
```

## Architecture

Two pieces:

1. **One-time migration script** (`scripts/migrate-portraits-to-cloudinary.ts`) — backup → upload → DB flip. Resumable.
2. **App-side URL helper** — the two functions in `heroImages.ts` inject Cloudinary transforms when `portrait_url` is a Cloudinary URL; all other URLs pass through unchanged.

## Migration Script

`scripts/migrate-portraits-to-cloudinary.ts` (run with `npx tsx` / `ts-node`, matching the existing `scripts/*.ts` pattern).

**Credentials & setup:** follows the existing `scripts/*.ts` pattern — `import 'dotenv/config'` then read from `.env.local` (gitignored):

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (not inline).
- `EXPO_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for `createClient(...)`, exactly as `scripts/backfill-hero-stats.ts` does, with an upfront missing-env guard.

Run the same way as the other one-off scripts in `scripts/` (e.g. `npx tsx scripts/migrate-portraits-to-cloudinary.ts`).

**Flow** — query all heroes where `portrait_url LIKE '%supabase.co/storage%'`, then for each (concurrency limit ~8):

1. **Backup:** download the original from the Supabase URL → `./portrait-backup/{id}.jpg`. Skip if the file already exists.
2. **Upload:** `cloudinary.uploader.upload(localPath, { public_id: 'hero-portraits/{id}', overwrite: false })`. If the asset already exists on Cloudinary, the SDK returns the existing one — effectively a skip.
3. **DB flip:** `update heroes set portrait_url = '<cloudinary secure base url>' where id = '{id}'`.

**Resumability:** all three steps are individually skippable (file exists / asset exists / `portrait_url` already Cloudinary), so re-running continues where it left off.

**`--dry-run` flag:** logs what it *would* do (counts, sample URLs) without downloading, uploading, or writing. Used for the first safe pass.

**Logging:** progress counter (`N of 1266`), per-hero success/skip/fail, and a final summary (migrated / skipped / failed lists).

## App-Side URL Helper

In `src/constants/heroImages.ts`:

```ts
const CLOUDINARY_CLOUD = 'dgrsb5o4p'; // public — appears in every delivery URL
const CLOUDINARY_MARKER = `res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/`;

// Inject f_auto,q_auto,w_<width> into a Cloudinary delivery URL's /upload/ segment.
// Non-Cloudinary URLs (Supabase, akabab CDN, external) are returned unchanged.
function withCloudinaryTransform(url: string, width: number): string {
  const i = url.indexOf('/upload/');
  if (i === -1 || !url.includes(CLOUDINARY_MARKER)) return url;
  const insertAt = i + '/upload/'.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,w_${width}/${url.slice(insertAt)}`;
}
```

**Widths per context:**

| Function | Context | Width |
|---|---|---|
| `heroGridImageSource` | grid / thumbnail cards | `w_600` |
| `heroImageSource` | detail screen, banners, carousels | `w_900` |
| lightbox / full-screen (`ImageLightbox`) | full view | `w_1280` |

`f_auto` (best format per client: WebP/AVIF) and `q_auto` (ML-tuned compression) always applied. Widths are tunable constants.

Both source functions apply `withCloudinaryTransform(resolvedUrl, width)` to whichever URL wins their existing priority chain, so the change is additive and behaviour for non-Cloudinary URLs is identical to today.

The lightbox (`src/components/ImageLightbox.tsx`) and any direct full-res render should request `w_1280` via the same helper when the URL is Cloudinary.

## Phased Rollout

1. Add `CLOUDINARY_*` keys to `.env.local` and `.env.example` (placeholder values in the example).
2. Land the `heroImages.ts` helper change (safe no-op for existing Supabase URLs).
3. Run migration `--dry-run`, sanity-check counts/sample output.
4. Run the real migration. Rows flip individually; nothing breaks mid-run.
5. Verify in the running app (iOS + web) that portraits load and look right.
6. **You-gated cleanup:** delete the Supabase `hero-portraits` bucket. This is the step that drops storage under quota.

## Error Handling

- Per-hero failures (download 404, upload error) are logged and collected; the script continues and reports the failed ids at the end for a targeted re-run.
- A hero whose Supabase original 404s keeps its existing `portrait_url` untouched (no flip), so it still falls through the existing chain.
- The app helper never throws: a malformed or non-Cloudinary URL is returned unchanged.

## Testing

- **Unit tests for `withCloudinaryTransform`** (in `__tests__/constants/heroImages.test.ts`, extending existing coverage):
  - Cloudinary URL + width → correct `/upload/f_auto,q_auto,w_600/...` injection.
  - Non-Cloudinary URL (Supabase, akabab CDN, external) → returned unchanged.
  - Empty string → returned unchanged.
  - `heroGridImageSource` / `heroImageSource` produce transformed URLs for Cloudinary portraits and untouched URLs otherwise.
- The migration script is a one-off; `--dry-run` is its safety check rather than unit tests.

## Out of Scope

- Migrating the ~1,684 external/CDN-backed heroes (they have no Supabase portrait).
- Re-generating or upscaling portraits — the existing Supabase originals are the masters.
- `user-media` bucket (already empty).
