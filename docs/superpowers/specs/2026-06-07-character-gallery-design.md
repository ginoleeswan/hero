# Character Gallery Design

## Overview

Add two new horizontal-scroll gallery sections to the character detail screen:

1. **Character Art** — variant artwork/images of the character from ComicVine's images resource
2. **In Print** — comic issue covers from the character's appearance history

Both sections follow the existing `MovieStrip` pattern (horizontal `ScrollView`, tap to open fullscreen lightbox). Web and native parity throughout.

## Data Architecture

### Database

New migration adds two columns to `heroes`:

```sql
alter table heroes
  add column gallery_images jsonb,   -- [{url, tags}]
  add column issue_covers   jsonb;   -- [{url, name, issueNumber, year}]
```

After migration, regenerate `database.generated.ts` via Supabase MCP.

### Edge Function: `get-hero-gallery`

New Supabase edge function (`supabase/functions/get-hero-gallery/index.ts`).

**Input:** `{ heroId: string, comicvineId: string }`

**ComicVine calls:**

1. **Character art** — `/images/?filter=object_type:character,object_id={comicvineId}&field_list=image,tags&limit=12`
   - Maps each result to `{ url: image.medium_url, tags: image.image_tags ?? null }`
   - Skips results with no usable URL

2. **Issue covers** — `/character/4005-{comicvineId}/?field_list=issue_credits`
   - Takes the first 20 items from `issue_credits`
   - Batch-fetches each via `api_detail_url?field_list=image,name,issue_number,cover_date`
   - Maps to `{ url: image.medium_url, name, issueNumber, year: cover_date?.slice(0,4) }`
   - Skips results with no cover image

**After fetching:** writes `gallery_images` and `issue_covers` to the `heroes` row, returns both arrays.

**Null response** (error or no comicvineId): `{ galleryImages: null, issueCovers: null }`

### Client: `src/lib/api.ts`

Add `fetchHeroGallery(heroId, comicvineId)` — invokes `get-hero-gallery` edge function, returns `{ galleryImages, issueCovers }`.

### Client: `src/lib/db/heroes.ts`

`heroRowToCharacterData` does not need changes — gallery data is read directly from `heroRow` on the character screen (same as `movies`, `powers`, etc.).

## Character Screen Integration

### Trigger logic (mirrors `needsComicVine` pattern)

```ts
const needsGallery =
  heroRow.comicvine_id != null &&
  (heroRow.gallery_images === null || heroRow.issue_covers === null);
```

If `needsGallery`, call `fetchHeroGallery` after the main `fetchHeroDetails` settles. On success, merge results into local state. Results are written to DB by the edge function, so next visit reads from `heroRow` directly.

### Local state

```ts
const [galleryImages, setGalleryImages] = useState<GalleryImage[] | null>(null);
const [issueCovers, setIssueCovers]   = useState<IssueCover[]   | null>(null);
const [galleryLoading, setGalleryLoading] = useState(false);
```

Seeded from `heroRow.gallery_images` / `heroRow.issue_covers` when the row is available.

### Section placement (in scroll order, after On Screen)

```
… existing sections …
On Screen
Character Art       ← new
In Print            ← new
Appearance
Connections
```

### Skeleton loading

Both sections show skeleton placeholders while `galleryLoading` is true, matching the existing `SkeletonProvider` + `Skeleton` pattern used for On Screen.

## New Components

### `GalleryStrip` (`src/components/GalleryStrip.tsx`)

Generic horizontal strip for image-only galleries. Props:

```ts
interface Props {
  images: { url: string; caption?: string | null }[];
  onPress: (index: number) => void;
}
```

- Card size: 80×110 (portrait, same aspect ratio as issue covers)
- Rounded corners (8px), `expo-image` with `cachePolicy="memory-disk"`
- `recyclingKey` per image URL
- Placeholder (dark navy tile with image icon) when URL is absent

Used by both Character Art and In Print sections (issue covers supply `caption = name`).

### `ImageLightbox` (`src/components/ImageLightbox.tsx`)

Full-screen image viewer. Props:

```ts
interface Props {
  images: { url: string; caption?: string | null }[];
  initialIndex: number;
  onClose: () => void;
}
```

- Renders as a `Modal` (works on web and native)
- Black background, `expo-image` at full screen with `contentFit="contain"`
- Swipe left/right (via `PanResponder` or `FlatList` with `pagingEnabled`) to navigate between images
- Caption rendered below image (FlameSans-Regular, white, semi-transparent)
- Close button (top-right X) with safe area insets
- On web: left/right arrow key handlers via `window.addEventListener('keydown')`

## Types (`src/types/index.ts`)

```ts
export type GalleryImage = { url: string; tags: string | null };
export type IssueCover   = { url: string; name: string | null; issueNumber: string | null; year: string | null };
```

## Error Handling

- If the gallery edge function fails or returns null arrays, sections simply don't render (no error state shown to user).
- If `comicvineId` is null (hero not in ComicVine), gallery sections are omitted silently.
- Individual images that fail to load fall back to the `GalleryStrip` placeholder tile.

## Testing

- Unit test `get-hero-gallery` response mapping with mocked ComicVine payloads
- Unit test the `needsGallery` guard logic
- `GalleryStrip` snapshot test with a small image array
- `ImageLightbox` snapshot test (closed + open states)
