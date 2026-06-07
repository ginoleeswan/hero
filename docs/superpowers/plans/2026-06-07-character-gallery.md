# Character Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Character Art" and "In Print" horizontal-scroll gallery sections to the character detail screen, backed by a new `get-hero-gallery` Supabase edge function and two new DB columns.

**Architecture:** A new `get-hero-gallery` edge function fetches character images and issue covers from ComicVine, writes them to two new `jsonb` columns on `heroes`, and returns the data. The character screen reads these columns from the existing `heroRow` React Query cache; if null, it calls `fetchHeroGallery` lazily after main data loads. Two new components handle rendering: `GalleryStrip` (horizontal scroll strip) and `ImageLightbox` (full-screen modal with swipe + keyboard navigation).

**Tech Stack:** Deno edge function, Supabase MCP, expo-image, React Native FlatList (pagingEnabled), Platform.OS web guard for keyboard events.

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260607140000_add_gallery_columns.sql` |
| Regen  | `src/types/database.generated.ts` (via Supabase MCP — never edit by hand) |
| Modify | `src/types/index.ts` |
| Modify | `src/lib/api.ts` |
| Create | `supabase/functions/get-hero-gallery/index.ts` |
| Create | `src/components/GalleryStrip.tsx` |
| Create | `src/components/ImageLightbox.tsx` |
| Modify | `app/character/[id].tsx` |
| Modify | `__tests__/lib/api.test.ts` |
| Create | `__tests__/components/GalleryStrip.test.tsx` |
| Create | `__tests__/components/ImageLightbox.test.tsx` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260607140000_add_gallery_columns.sql`
- Regen: `src/types/database.generated.ts`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260607140000_add_gallery_columns.sql
alter table heroes
  add column if not exists gallery_images jsonb,
  add column if not exists issue_covers   jsonb;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Regenerate TypeScript types**

Use `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260607140000_add_gallery_columns.sql src/types/database.generated.ts
git commit -m "feat(db): add gallery_images and issue_covers columns to heroes"
```

---

## Task 2: Add Gallery Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add types after the `FirstIssue` interface**

Add these two interfaces to `src/types/index.ts` (after `FirstIssue`):

```ts
export interface GalleryImage {
  url: string;
  tags: string | null;
}

export interface IssueCover {
  url: string;
  name: string | null;
  issueNumber: string | null;
  year: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add GalleryImage and IssueCover types"
```

---

## Task 3: `fetchHeroGallery` Client Function + Test

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `__tests__/lib/api.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/api.test.ts`:

```ts
import { fetchHeroGallery } from '../../src/lib/api';
```

Add this import alongside the existing imports at the top of the file (add `fetchHeroGallery` to the existing import line):

```ts
import {
  fetchHeroStats,
  fetchHeroDetails,
  fetchFirstIssue,
  generateVerdict,
  fetchHeroGallery,
} from '../../src/lib/api';
```

Then add the test suite at the bottom of the file:

```ts
describe('fetchHeroGallery', () => {
  it('returns galleryImages and issueCovers on success', async () => {
    const payload = {
      galleryImages: [{ url: 'https://cv.example.com/art1.jpg', tags: null }],
      issueCovers: [{ url: 'https://cv.example.com/cover1.jpg', name: 'ASM #1', issueNumber: '1', year: '1963' }],
    };
    mockInvoke.mockResolvedValueOnce({ data: payload, error: null });

    const result = await fetchHeroGallery('620', '4005-1977');
    expect(result.galleryImages).toHaveLength(1);
    expect(result.galleryImages![0].url).toBe('https://cv.example.com/art1.jpg');
    expect(result.issueCovers).toHaveLength(1);
    expect(result.issueCovers![0].name).toBe('ASM #1');
    expect(mockInvoke).toHaveBeenCalledWith('get-hero-gallery', {
      body: { heroId: '620', comicvineId: '4005-1977' },
    });
  });

  it('returns null arrays when edge function errors', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'edge error' } });
    const result = await fetchHeroGallery('620', '4005-1977');
    expect(result.galleryImages).toBeNull();
    expect(result.issueCovers).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
yarn test:ci --testPathPattern="api.test"
```

Expected: FAIL — `fetchHeroGallery` is not exported from `../../src/lib/api`

- [ ] **Step 3: Implement `fetchHeroGallery` in `src/lib/api.ts`**

Add these imports at the top of `src/lib/api.ts` (alongside existing type imports):

```ts
import type { GalleryImage, IssueCover } from '../types';
```

Then add the function after `fetchFirstIssue`:

```ts
export async function fetchHeroGallery(
  heroId: string,
  comicvineId: string,
): Promise<{ galleryImages: GalleryImage[] | null; issueCovers: IssueCover[] | null }> {
  const { data, error } = await supabase.functions.invoke<{
    galleryImages: GalleryImage[] | null;
    issueCovers: IssueCover[] | null;
  }>('get-hero-gallery', { body: { heroId, comicvineId } });

  if (error || !data) {
    console.warn('[fetchHeroGallery] error:', error?.message);
    return { galleryImages: null, issueCovers: null };
  }
  return {
    galleryImages: data.galleryImages ?? null,
    issueCovers: data.issueCovers ?? null,
  };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
yarn test:ci --testPathPattern="api.test"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts __tests__/lib/api.test.ts
git commit -m "feat(api): add fetchHeroGallery client function"
```

---

## Task 4: `get-hero-gallery` Edge Function

**Files:**
- Create: `supabase/functions/get-hero-gallery/index.ts`

- [ ] **Step 1: Create the edge function**

```ts
// supabase/functions/get-hero-gallery/index.ts
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

const NULL_RESPONSE = { galleryImages: null, issueCovers: null };

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

    // Strip any "4005-" prefix — the images endpoint just needs the numeric id
    const numericId = comicvineId.replace(/^4005-/, '');

    // ── Character art images ──────────────────────────────────────────────────
    let galleryImages: Array<{ url: string; tags: string | null }> | null = null;
    const artParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      filter: `object_type:character,object_id:${numericId}`,
      field_list: 'image,image_tags',
      limit: '12',
    });
    const artRes = await fetch(`${COMICVINE_BASE}/images/?${artParams}`);
    if (artRes.ok) {
      const artJson = await artRes.json();
      const items: Array<{ url: string; tags: string | null }> = (
        artJson.results ?? []
      )
        .map((r: unknown) => {
          const row = r as Record<string, unknown>;
          const img = row.image as Record<string, unknown> | undefined;
          const url: string | null = (img?.medium_url as string) ?? null;
          const tags: string | null =
            typeof row.image_tags === 'string' ? row.image_tags : null;
          return url ? { url, tags } : null;
        })
        .filter((x: { url: string; tags: string | null } | null): x is { url: string; tags: string | null } => x !== null);
      galleryImages = items.length > 0 ? items : null;
    }

    // ── Issue covers ──────────────────────────────────────────────────────────
    let issueCovers: Array<{
      url: string;
      name: string | null;
      issueNumber: string | null;
      year: string | null;
    }> | null = null;

    const creditsParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      field_list: 'issue_credits',
    });
    const creditsRes = await fetch(
      `${COMICVINE_BASE}/character/4005-${numericId}/?${creditsParams}`,
    );
    if (creditsRes.ok) {
      const creditsJson = await creditsRes.json();
      const rawCredits: Array<Record<string, unknown>> = Array.isArray(
        creditsJson.results?.issue_credits,
      )
        ? creditsJson.results.issue_credits
        : [];

      const first20 = rawCredits.slice(0, 20);

      const covers = await Promise.all(
        first20.map(async (credit) => {
          const apiDetailUrl = typeof credit.api_detail_url === 'string'
            ? credit.api_detail_url
            : null;
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
            const url: string | null = (data.image as Record<string, unknown>)?.medium_url as string ?? null;
            if (!url) return null;
            const coverDate: string | null =
              typeof data.cover_date === 'string' ? data.cover_date : null;
            return {
              url,
              name: typeof data.name === 'string' ? data.name : null,
              issueNumber: data.issue_number != null ? String(data.issue_number) : null,
              year: coverDate ? coverDate.slice(0, 4) : null,
            };
          } catch {
            return null;
          }
        }),
      );

      const validCovers = covers.filter(
        (c): c is { url: string; name: string | null; issueNumber: string | null; year: string | null } =>
          c !== null,
      );
      issueCovers = validCovers.length > 0 ? validCovers : null;
    }

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    await supabase
      .from('heroes')
      .update({
        gallery_images: galleryImages as unknown as Record<string, unknown>[] | null,
        issue_covers: issueCovers as unknown as Record<string, unknown>[] | null,
      })
      .eq('id', heroId);

    return json({ galleryImages, issueCovers });
  } catch (err) {
    console.error('[get-hero-gallery]', err);
    return json(NULL_RESPONSE, 500);
  }
});
```

- [ ] **Step 2: Deploy the edge function via Supabase MCP**

Use `mcp__supabase__deploy_edge_function` with:
- name: `get-hero-gallery`
- entrypoint: `supabase/functions/get-hero-gallery/index.ts`

- [ ] **Step 3: Smoke test manually**

Open a character with a known `comicvine_id` (e.g. Spider-Man). Navigate to the character screen and watch the console — the gallery fetch will fire after the main data loads. Check Supabase logs via `mcp__supabase__get_logs` if needed.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/get-hero-gallery/index.ts
git commit -m "feat(edge): add get-hero-gallery Supabase edge function"
```

---

## Task 5: `GalleryStrip` Component + Test

**Files:**
- Create: `src/components/GalleryStrip.tsx`
- Create: `__tests__/components/GalleryStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/GalleryStrip.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GalleryStrip } from '../../src/components/GalleryStrip';

jest.mock('expo-image', () => ({ Image: 'Image' }));

const IMAGES = [
  { url: 'https://example.com/a.jpg', caption: 'Issue #1' },
  { url: 'https://example.com/b.jpg', caption: null },
];

describe('GalleryStrip', () => {
  it('renders the correct number of image cards', () => {
    const { getAllByTestId } = render(
      <GalleryStrip images={IMAGES} onPress={jest.fn()} />,
    );
    expect(getAllByTestId('gallery-card')).toHaveLength(2);
  });

  it('calls onPress with the correct index', () => {
    const onPress = jest.fn();
    const { getAllByTestId } = render(
      <GalleryStrip images={IMAGES} onPress={onPress} />,
    );
    fireEvent.press(getAllByTestId('gallery-card')[1]);
    expect(onPress).toHaveBeenCalledWith(1);
  });

  it('renders nothing when images array is empty', () => {
    const { queryByTestId } = render(
      <GalleryStrip images={[]} onPress={jest.fn()} />,
    );
    expect(queryByTestId('gallery-card')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
yarn test:ci --testPathPattern="GalleryStrip"
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `GalleryStrip`**

```tsx
// src/components/GalleryStrip.tsx
import { ScrollView, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

const CARD_W = 80;
const CARD_H = 110;

interface Props {
  images: { url: string; caption?: string | null }[];
  onPress: (index: number) => void;
}

export function GalleryStrip({ images, onPress }: Props) {
  if (images.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {images.map((img, i) => (
        <TouchableOpacity
          key={i}
          testID="gallery-card"
          onPress={() => onPress(i)}
          activeOpacity={0.85}
        >
          <View style={styles.card}>
            {img.url ? (
              <Image
                source={{ uri: img.url }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={img.url}
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={22} color={COLORS.grey} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.navy + '18',
  },
  image: { width: CARD_W, height: CARD_H },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
yarn test:ci --testPathPattern="GalleryStrip"
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/GalleryStrip.tsx __tests__/components/GalleryStrip.test.tsx
git commit -m "feat(components): add GalleryStrip horizontal image strip"
```

---

## Task 6: `ImageLightbox` Component + Test

**Files:**
- Create: `src/components/ImageLightbox.tsx`
- Create: `__tests__/components/ImageLightbox.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/ImageLightbox.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ImageLightbox } from '../../src/components/ImageLightbox';

jest.mock('expo-image', () => ({ Image: 'Image' }));

const IMAGES = [
  { url: 'https://example.com/a.jpg', caption: 'Art 1' },
  { url: 'https://example.com/b.jpg', caption: null },
];

describe('ImageLightbox', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <ImageLightbox images={IMAGES} initialIndex={0} onClose={jest.fn()} />,
    );
    expect(getByTestId('lightbox-modal')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ImageLightbox images={IMAGES} initialIndex={0} onClose={onClose} />,
    );
    fireEvent.press(getByTestId('lightbox-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
yarn test:ci --testPathPattern="ImageLightbox"
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `ImageLightbox`**

```tsx
// src/components/ImageLightbox.tsx
import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  FlatList,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  images: { url: string; caption?: string | null }[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const indexRef = useRef(initialIndex);

  useEffect(() => {
    // Scroll to initial index after mount
    if (initialIndex > 0) {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }
  }, [initialIndex]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight') {
        const next = Math.min(indexRef.current + 1, images.length - 1);
        listRef.current?.scrollToIndex({ index: next, animated: true });
        indexRef.current = next;
      }
      if (e.key === 'ArrowLeft') {
        const prev = Math.max(indexRef.current - 1, 0);
        listRef.current?.scrollToIndex({ index: prev, animated: true });
        indexRef.current = prev;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  return (
    <Modal
      testID="lightbox-modal"
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={({ viewableItems }) => {
            if (viewableItems[0]) indexRef.current = viewableItems[0].index ?? 0;
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image
                source={{ uri: item.url }}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              {item.caption ? (
                <Text style={styles.caption} numberOfLines={2}>
                  {item.caption}
                </Text>
              ) : null}
            </View>
          )}
        />

        <TouchableOpacity
          testID="lightbox-close"
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 },
  caption: {
    position: 'absolute',
    bottom: 48,
    left: 20,
    right: 20,
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
yarn test:ci --testPathPattern="ImageLightbox"
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ImageLightbox.tsx __tests__/components/ImageLightbox.test.tsx
git commit -m "feat(components): add ImageLightbox full-screen image viewer"
```

---

## Task 7: Wire Up the Character Screen

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add imports at the top of `app/character/[id].tsx`**

Add to the existing import block:

```tsx
import { fetchHeroGallery } from '../../src/lib/api';
import { GalleryStrip } from '../../src/components/GalleryStrip';
import { ImageLightbox } from '../../src/components/ImageLightbox';
import type { GalleryImage, IssueCover } from '../../src/types';
```

- [ ] **Step 2: Add gallery state inside `CharacterScreen`**

Add alongside the existing state declarations (after `favCount` state):

```tsx
const [galleryImages, setGalleryImages] = useState<GalleryImage[] | null>(null);
const [issueCovers, setIssueCovers] = useState<IssueCover[] | null>(null);
const [galleryLoading, setGalleryLoading] = useState(false);
const [lightboxImages, setLightboxImages] = useState<{ url: string; caption?: string | null }[]>([]);
const [lightboxIndex, setLightboxIndex] = useState(0);
```

- [ ] **Step 3: Seed gallery from heroRow and trigger lazy fetch**

Inside the existing `useEffect` that watches `[id, heroRow?.id, ...]`, inside the `if (heroRow.enriched_at)` block, add after `setData(heroRowToCharacterData(heroRow))`:

```tsx
// Seed gallery from DB if already populated
if (heroRow.gallery_images) {
  setGalleryImages(heroRow.gallery_images as unknown as GalleryImage[]);
}
if (heroRow.issue_covers) {
  setIssueCovers(heroRow.issue_covers as unknown as IssueCover[]);
}

// Lazy-fetch gallery if columns are not yet populated
const needsGallery =
  heroRow.comicvine_id != null &&
  (heroRow.gallery_images === null || heroRow.issue_covers === null);
if (needsGallery) {
  setGalleryLoading(true);
  fetchHeroGallery(heroRow.id, heroRow.comicvine_id!)
    .then(({ galleryImages: imgs, issueCovers: covers }) => {
      if (imgs) setGalleryImages(imgs);
      if (covers) setIssueCovers(covers);
    })
    .catch(() => {})
    .finally(() => setGalleryLoading(false));
}
```

- [ ] **Step 4: Add gallery sections to JSX**

Inside the `<>` block (the section that renders when `data` is loaded), add after the `{/* On Screen */}` section and before `{/* Appearance */}`:

```tsx
{/* Character Art — skeleton only while this section's data is still loading */}
{galleryImages === null && galleryLoading ? (
  <SkeletonProvider>
    <Section title="Character Art">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={80} height={110} borderRadius={8} />
        ))}
      </View>
    </Section>
  </SkeletonProvider>
) : galleryImages && galleryImages.length > 0 ? (
  <Section title="Character Art">
    <GalleryStrip
      images={galleryImages.map((img) => ({ url: img.url, caption: null }))}
      onPress={(i) => {
        setLightboxImages(galleryImages.map((img) => ({ url: img.url })));
        setLightboxIndex(i);
      }}
    />
  </Section>
) : null}

{/* In Print — skeleton only while this section's data is still loading */}
{issueCovers === null && galleryLoading ? (
  <SkeletonProvider>
    <Section title="In Print">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={80} height={110} borderRadius={8} />
        ))}
      </View>
    </Section>
  </SkeletonProvider>
) : issueCovers && issueCovers.length > 0 ? (
  <Section title="In Print">
    <GalleryStrip
      images={issueCovers.map((c) => ({ url: c.url, caption: c.name }))}
      onPress={(i) => {
        setLightboxImages(issueCovers.map((c) => ({ url: c.url, caption: c.name })));
        setLightboxIndex(i);
      }}
    />
  </Section>
) : null}
```

- [ ] **Step 5: Add the lightbox modal**

Add at the end of the return, after the `FirstIssueModal` and before the closing `</View>`:

```tsx
{lightboxImages.length > 0 ? (
  <ImageLightbox
    images={lightboxImages}
    initialIndex={lightboxIndex}
    onClose={() => setLightboxImages([])}
  />
) : null}
```

- [ ] **Step 6: Run all tests**

```bash
yarn test:ci
```

Expected: all tests PASS

- [ ] **Step 7: Smoke test on simulator/device**

Start the dev server and open a character with a known `comicvine_id` (e.g. Spider-Man, Batman). Verify:
- Gallery skeletons appear briefly after main content loads
- "Character Art" strip appears with images (or is hidden if none returned)
- "In Print" strip appears with comic covers
- Tapping any image opens the lightbox
- Lightbox can be closed with the X button
- On web: arrow keys navigate between images, Escape closes
- Both strips scroll horizontally on native and web

- [ ] **Step 8: Commit**

```bash
git add app/character/[id].tsx
git commit -m "feat(character): add Character Art and In Print gallery sections"
```
