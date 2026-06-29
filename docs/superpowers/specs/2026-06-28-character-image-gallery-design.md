# Character Image Gallery — Design

**Date:** 2026-06-28
**Status:** Approved (pending spec review)

## Goal

Add an image gallery of a character to their info page. Ship a ComicVine-sourced
gallery now, but with a data model designed to absorb other image sources later
(AI-generated, curated uploads, wiki scrapes). "Both": deliver value immediately
without painting ourselves into a single-source corner.

## Reality check that shaped the design

ComicVine's **character** resource exposes exactly one `image` field — there is
no per-character image gallery, no images endpoint, and no `image_tags` for
characters (verified against the ComicVine API docs). The only character-specific
imagery ComicVine offers in bulk is the cover art of the issues a character
appears in, via `issue_credits`. That cover art is already fetched today and
rendered as the "In Print → Cover gallery" strip.

So the ComicVine half of the gallery is: the character's own primary `image`
(the lead "artwork of the character") plus cover art from their appearances.
True varied character artwork (costumes, poses, pin-ups) is out of scope for the
ComicVine source and would arrive later through a different source — which the
data model is built to accommodate.

## Current state (what already exists)

- `heroes.issue_covers` (jsonb array of `IssueCover`) — up to 20 ComicVine covers.
- `heroes.gallery_enriched_at` — "already fetched" sentinel (null = never fetched).
- `supabase/functions/get-hero-gallery` — fetches covers from `issue_credits`,
  persists to `issue_covers`, sets the sentinel.
- `src/lib/api.ts → fetchHeroGallery()` — client wrapper invoking that edge fn.
- `useHeroDetail` — holds `issueCovers` + `galleryLoading`; seeds from the row,
  lazy-fetches when the sentinel is null.
- `src/components/GalleryStrip.tsx` + `src/components/ImageLightbox.tsx` — the
  reusable strip + full-screen viewer, used by both `[id].tsx` and `[id].web.tsx`.

The infrastructure is all present. This work generalizes the data model from
"comic covers" to "multi-source images" and elevates the section.

## Approach (chosen: A — normalized table)

Rejected alternative B (generalize the `issue_covers` jsonb with a `source`
field): future independent pipelines would have to read-modify-write the whole
blob (race-prone), with no cross-source dedupe or indexed queries. A normalized
table lets each source `INSERT` independently and is the repo's preferred shape
(upstream DB normalization over per-render parsing).

## Design

### 1. Data model — new `hero_images` table

```sql
create table hero_images (
  id          uuid primary key default gen_random_uuid(),
  hero_id     text not null references heroes(id) on delete cascade,
  url         text not null,
  source      text not null,              -- 'comicvine_primary' | 'comicvine_cover' | 'ai' | 'curated'
  caption     text,
  issue_id    text,                       -- set for covers → enables /issue/[id] read-through
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (hero_id, url)
);
create index hero_images_hero_id_idx on hero_images (hero_id, sort_order);
```

- `heroes.id` is `text` (mixed `h_`, `cv-`, numeric schemes) → FK is `text`.
- **RLS:** enable RLS and add a public-read (anon `select`) policy. Without it,
  anon reads return 0 rows and the gallery is silently empty. Writes are
  service-role only (the edge function).
- `unique (hero_id, url)` makes every writer idempotent — future AI/curated
  pipelines `INSERT … ON CONFLICT (hero_id, url) DO NOTHING`, no blob races.
- `issue_id` preserves the existing cover → `/issue/[id]` read-through for
  `comicvine_cover` rows; other sources leave it null.
- `sort_order` defines display order; the ComicVine primary image takes 0, covers
  take 1…N. Reads order by `sort_order, created_at`.

### 2. Migration backfill (same migration)

Unpack each hero's existing `heroes.issue_covers` jsonb into `hero_images` rows:

- `source = 'comicvine_cover'`
- `url = cover.url`, `caption = cover.name`, `issue_id = cover.id`
- `sort_order = array_index + 1` (leaves 0 free for the primary image)

One-time, idempotent via the unique constraint, no data loss. `heroes.issue_covers`
is left in place (untouched) as a legacy column but drops out of the read path.
`gallery_enriched_at` keeps its meaning.

After applying the migration, regenerate `src/types/database.generated.ts`.

### 3. Edge function — rewrite `get-hero-gallery`

- Single character call with `field_list=image,issue_credits`.
- Insert the character's own ComicVine `image` (`super_url` ?? `original_url`) as
  `source='comicvine_primary'`, `sort_order=0` — the lead "artwork of the
  character" item. Skip if absent.
- Fetch cover art per issue credit as today, but: raise the cap 20 → 40, and use
  `original_url ?? medium_url` for higher resolution. Insert as
  `source='comicvine_cover'`, `sort_order` 1…N, `issue_id` = the credit's issue id.
- All inserts use `ON CONFLICT (hero_id, url) DO NOTHING` (idempotent).
- Set `gallery_enriched_at` so the fetch runs once per hero (existing gating).
- The old id-backfill path is no longer needed — `issue_id` is written at insert.

### 4. Client data layer — `src/lib/db/heroImages.ts`

```ts
export interface HeroImage {
  url: string;
  caption: string | null;
  source: string;
  issueId: string | null;
}
export async function getHeroImages(heroId: string): Promise<HeroImage[]>;
```

Selects from `hero_images` ordered by `sort_order, created_at`, mapping
`issue_id → issueId`. The `HeroImage` type lives in `src/types/index.ts`.
`IssueCover` stays for the legacy seed but the gallery consumes `HeroImage[]`.

### 5. Hook — `useHeroDetail`

Replace `issueCovers` with `galleryImages: HeroImage[] | null`:

- Read via `getHeroImages(heroRow.id)` once the row is known.
- If `heroRow.gallery_enriched_at === null` and the hero has a `comicvine_id`,
  invoke the edge fn via `fetchHeroGallery`, then re-read `getHeroImages`.
- Preserve `galleryLoading`.
- Single change point — both platform views consume `galleryImages` by the same
  name, so they cannot drift (CLAUDE.md platform rule).

### 6. UI — `app/character/[id].tsx` and `[id].web.tsx`

Promote the nested "In Print → Cover gallery" into its own **"Gallery"** section,
fed by `galleryImages` through the existing `GalleryStrip` + `ImageLightbox`.
It now leads with the character's own art, so a standalone section reads better
than burying it under "In Print". The first-appearance visual stays where it is.

Tap behaviour preserved: an item with `issueId` opens the `/issue/[id]`
read-through; otherwise it opens the lightbox. Both files change identically
(thin view layers over the shared hook).

### 7. Testing

- Unit-test `getHeroImages` with a mocked Supabase client: verifies ordering and
  `issue_id → issueId` field mapping.
- Edge function is not unit-tested (no Deno test harness in this repo, per norm).
- No screen/navigation/render tests (keep tests fast and focused).

## Addendum — re-enrich of the existing catalogue (post-implementation)

The first backfill (`20260628120000_hero_images.sql`) seeded only `comicvine_cover`
rows and left `gallery_enriched_at` set, so already-enriched heroes would never
re-run the edge fn and would miss the new `comicvine_primary` lead image. Two
changes close that gap:

- **Edge fn — scoped, idempotent cover replacement.** When a fresh (non-throttled)
  cover set is fetched, the fn first deletes *that hero's* `comicvine_cover` rows,
  then re-inserts. This lets a resolution change (`medium_url` backfill →
  `original_url`) refresh in place without the `(hero_id, url)` unique constraint
  leaving both copies. Skipped on throttle/empty so a good gallery is never wiped.
- **Sentinel reset migration** (`20260628190000_..._reenrich_sentinel_reset.sql`):
  nulls `gallery_enriched_at` for every `comicvine_id` hero (deletes nothing) so
  the lazy enrich re-runs on next view and the whole catalogue picks up the primary
  image + hi-res covers. Popular heroes were additionally warmed by a one-off
  proactive backfill that stops on the first ComicVine 420 throttle.

## Out of scope (YAGNI)

- AI-generated and curated/admin-upload sources — the table supports them, but no
  pipeline is built here. They land as separate future work that just inserts rows.
- Dropping or migrating away the legacy `heroes.issue_covers` column.
- Image dimensions/metadata columns beyond what's listed.
