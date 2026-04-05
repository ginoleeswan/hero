# Hero Portrait Generation — Design Spec

**Date:** 2026-04-04  
**Status:** Approved

## Overview

Generate consistent Mike Mitchell–style side-profile bust portraits for all 564 heroes in the database and serve them from Supabase Storage rather than the local app bundle. The 34 heroes that already have curated Mike Mitchell images are uploaded as-is; the remaining ~530 are styled via Gemini 2.0 Flash image-to-image generation.

## Goals

- Uniform visual style across all 564 heroes
- Images served from Supabase Storage CDN (not bundled in the app)
- Resumable, idempotent batch script safe to interrupt and re-run
- Test with a single hero before running the full batch

## Non-goals

- Re-generating the 34 existing curated portraits with AI
- Real-time / on-demand generation (all portraits are pre-generated offline)
- Any changes to the auth, navigation, or favourites systems

---

## Database

### Migration
Add `portrait_url text` column to the `heroes` table:

```sql
ALTER TABLE heroes ADD COLUMN portrait_url text;
```

`portrait_url` holds the public Supabase Storage URL for the hero's generated portrait. `NULL` means no portrait has been generated yet. `image_url` and `image_md_url` are unchanged and remain as fallbacks.

### Regeneration flag
The script determines whether a hero needs processing by checking `portrait_url IS NULL`. Re-running the script safely skips already-processed heroes.

---

## Supabase Storage

- **Bucket name:** `hero-portraits`
- **Access:** public read, authenticated write (service role key used by the script)
- **File naming:** `{hero-id}.jpg` — one file per hero, deterministic, idempotent
- **URL pattern:** `{SUPABASE_URL}/storage/v1/object/public/hero-portraits/{hero-id}.jpg`

---

## Batch Script

**Location:** `scripts/generate-portraits.ts`  
**Runtime:** Bun (`bun scripts/generate-portraits.ts`)

### CLI flags

| Flag | Description |
|---|---|
| `--hero-id <id>` | Process a single hero only (for testing) |
| `--dry-run` | Log what would be processed without making API calls |
| `--concurrency <n>` | Parallel workers (default: 3) |

### Phase 1 — Upload existing curated images (34 heroes)

For each hero ID in `HERO_IMAGES` (from `src/constants/heroImages.ts`):
1. Skip if `portrait_url IS NOT NULL` in DB
2. Read the local bundled image file
3. Upload to `hero-portraits/{id}.jpg` in Supabase Storage
4. `UPDATE heroes SET portrait_url = '...' WHERE id = '...'`

No Gemini call — these images are already in the correct style.

### Phase 2 — Generate portraits for remaining heroes (~530)

For each hero where `portrait_url IS NULL`:
1. Fetch the source image from `image_url` (existing SuperheroAPI CDN)
2. Load `assets/images/spiderman.jpg` as the style reference (base64)
3. POST to Gemini 2.0 Flash (`gemini-2.0-flash-preview-image-generation`) with:
   - **Image 1 (source):** the hero's existing API image
   - **Image 2 (style reference):** `spiderman.jpg`
   - **Prompt:**
     ```
     Redraw the character from the first image as a side-profile bust portrait 
     in exactly the style of the second reference image: flat graphic illustration, 
     bold solid background colour, simplified clean shapes, head and shoulders crop, 
     smooth flat shading with subtle gradients, clean outlines, poster art aesthetic. 
     Preserve the character's costume colours and identity. Do not include any text.
     ```
4. Decode the returned image bytes
5. Upload to `hero-portraits/{id}.jpg` in Supabase Storage
6. `UPDATE heroes SET portrait_url = '...' WHERE id = '...'`

### Concurrency & rate limits

- Default concurrency: **3 workers** (conservative for AI Studio free tier)
- 429 responses trigger exponential backoff (1s → 2s → 4s → 8s, max 3 retries)
- Progress logged to stdout: `[42/530] Thor (659) ✓`

### Environment variables required

```
EXPO_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # write access to Storage
GOOGLE_AI_STUDIO_API_KEY=...    # Gemini image generation
```

`SUPABASE_SERVICE_ROLE_KEY` is only used by this script and never in the app bundle.

---

## App Changes

### `src/types/database.generated.ts`
Regenerated after migration — `portrait_url: string | null` appears automatically.

### `src/constants/heroImages.ts` — `heroImageSource()`
Updated priority order:
1. `portrait_url` from DB (Supabase Storage CDN) ← **new, highest priority**
2. Local bundled image from `HERO_IMAGES` map (fallback during migration)
3. `imageUrl` if it starts with `http`
4. CDN fallback via numeric id

```ts
export function heroImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
): number | { uri: string } {
  if (portraitUrl) return { uri: portraitUrl };
  const local = HERO_IMAGES[String(id)];
  if (local) return local;
  if (imageUrl?.startsWith('http')) return { uri: imageUrl };
  return { uri: `${CDN_BASE}/${id}.jpg` };
}
```

### `src/lib/db/heroes.ts`
- `getHeroesByCategory()` — add `portrait_url` to the select
- `searchHeroes()` — add `portrait_url` to the select
- `getHeroById()` — already selects `*`, no change needed
- `heroRowToCharacterData()` — pass `portrait_url` through to `stats.image.url` (or a new field)

### Call sites
`HeroCard`, `CharacterScreen`, `ProfileScreen` (`FavouriteThumb`) — each passes `portrait_url` down to `heroImageSource()`. The signature change is additive (new optional param), so no existing call sites break.

---

## Testing Plan

1. Run `bun scripts/generate-portraits.ts --hero-id 69` (Aquaman — well-known, no local portrait)
2. Visually review the generated image in Supabase Storage dashboard
3. Verify `portrait_url` is set correctly in the DB
4. Open the app, navigate to Aquaman's character screen — portrait should render from Supabase Storage
5. If quality is acceptable, run the full batch: `bun scripts/generate-portraits.ts`

---

## Migration & Rollout Order

1. Apply DB migration (`portrait_url` column)
2. Regenerate `database.generated.ts`
3. Update `heroImageSource()` signature (additive, backwards compatible)
4. Update DB query functions to select `portrait_url`
5. Update call sites to pass `portrait_url`
6. Run single-hero test
7. Run full batch script
8. Remove `HERO_IMAGES` local bundled images from the app bundle (optional cleanup, after all portraits confirmed)
