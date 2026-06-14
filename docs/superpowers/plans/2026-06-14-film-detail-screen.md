# Film Detail Screen — Full-Screen Route + Strip Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped `MovieDetailSheet` bottom-sheet modal with a cinematic full-screen film route (`app/film/[tmdbId].tsx`), redesign `MovieStrip` to use a landscape backdrop featured card, and render watch-provider logos from TMDB.

**Architecture:** Data layer extended in `src/lib/db/films.ts` (new helpers `extractProviders`, `getFilmById`, `getFilmHeroes`, `pickFeaturedFilm`); new film route `app/film/[tmdbId].tsx` composes small section components from `src/components/film/`; `MovieStrip` is redesigned and wired to `router.push` instead of the deleted modal; `MovieDetailSheet.tsx` is deleted.

**Tech Stack:** Expo SDK 56, expo-router 4, expo-image, expo-linear-gradient, react-native-webview, React Native StyleSheet, TypeScript, jest-expo.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/db/films.ts` | Add `WatchProvider`, `extractProviders`, `getFilmById`, `getFilmHeroes`, `pickFeaturedFilm`; add `revenue` field to `HeroFilm` |
| Modify | `__tests__/lib/db/films.test.ts` | Add tests for all new helpers; update existing mock for `revenue` field |
| Create | `src/components/film/FilmBackdropHeader.tsx` | Backdrop + gradient scrim + poster + title + meta pills + back button |
| Create | `src/components/film/FilmTrailer.tsx` | Trailer button → inline YouTube iframe (web) / WebView (native) / Linking fallback |
| Create | `src/components/film/WhereToWatch.tsx` | Provider logo chips row |
| Create | `src/components/film/CastRail.tsx` | Full-bleed horizontal cast member rail |
| Create | `src/components/film/StillsGallery.tsx` | Full-bleed horizontal stills rail with ImageLightbox on tap |
| Create | `src/components/film/HeroesInFilmRail.tsx` | Full-bleed horizontal RelatedHeroCard rail navigating to character screens |
| Create | `app/film/[tmdbId].tsx` | Full-screen film route screen (expo-router, headerShown: false) |
| Modify | `src/components/MovieStrip.tsx` | Landscape backdrop featured card; router.push to film route; remove MovieDetailSheet; films "+N" toggles showAll |
| Delete | `src/components/MovieDetailSheet.tsx` | No longer needed |
| Modify | `app/character/[id].tsx` | Remove now-unused MovieDetailSheet import if any (minimal change only) |

---

## Task 1: Extend `src/lib/db/films.ts` — data layer additions

**Files:**
- Modify: `src/lib/db/films.ts`

- [ ] **Step 1: Read the current file content**

Open `src/lib/db/films.ts`. Note: `HeroFilm` currently has fields `tmdbId, title, year, posterUrl, backdropUrl, voteAverage, runtime, overview, trailerKey, watchProviders, cast, stills`. The DB query selects from `hero_film_appearances` joined to `films`.

- [ ] **Step 2: Add `revenue` to `HeroFilm`, add imports, add `WatchProvider` type and helpers**

Replace the entire file content:

```typescript
import { supabase } from '../supabase';
import type { RelatedHeroCard } from './heroes';

export interface HeroFilmCastMember {
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface HeroFilm {
  tmdbId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  runtime: number | null;
  overview: string | null;
  trailerKey: string | null;
  watchProviders: Record<string, unknown> | null;
  cast: HeroFilmCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
}

export interface WatchProvider {
  name: string;
  logoUrl: string | null;
}

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

/** Extract watch providers from the raw TMDB `results` blob.
 *  Prefers US region, falls back to first available region.
 *  Pulls from flatrate, rent, buy arrays; dedupes by provider_name. */
export function extractProviders(blob: Record<string, unknown> | null): WatchProvider[] {
  if (!blob) return [];
  // Prefer US; fall back to first available region.
  const regionData =
    (blob['US'] as Record<string, unknown> | undefined) ??
    Object.values(blob).find(
      (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
    );
  if (!regionData) return [];

  const seen = new Map<string, WatchProvider>();
  for (const key of ['flatrate', 'rent', 'buy'] as const) {
    const arr = regionData[key];
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p !== 'object' || p === null) continue;
      const row = p as Record<string, unknown>;
      const name = typeof row['provider_name'] === 'string' ? row['provider_name'] : null;
      if (!name || seen.has(name)) continue;
      const logoPath = typeof row['logo_path'] === 'string' ? row['logo_path'] : null;
      seen.set(name, { name, logoUrl: logoPath ? TMDB_LOGO_BASE + logoPath : null });
    }
  }
  return Array.from(seen.values());
}

/** The first film that has a backdropUrl; else first film; else null. */
export function pickFeaturedFilm(films: HeroFilm[]): HeroFilm | null {
  if (films.length === 0) return null;
  return films.find((f) => !!f.backdropUrl) ?? films[0];
}

interface FilmRow {
  tmdb_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  vote_average: number | null;
  runtime: number | null;
  overview: string | null;
  trailer_key: string | null;
  watch_providers: Record<string, unknown> | null;
  cast_members: HeroFilmCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
}

function filmRowToHeroFilm(f: FilmRow): HeroFilm {
  return {
    tmdbId: f.tmdb_id,
    title: f.title,
    year: f.year,
    posterUrl: f.poster_url,
    backdropUrl: f.backdrop_url,
    voteAverage: f.vote_average,
    runtime: f.runtime,
    overview: f.overview,
    trailerKey: f.trailer_key,
    watchProviders: f.watch_providers,
    cast: f.cast_members,
    stills: f.stills,
    revenue: f.revenue,
  };
}

interface JoinRow {
  rank: number | null;
  films: FilmRow | null;
}

const FILM_SELECT =
  'tmdb_id, title, year, poster_url, backdrop_url, vote_average, runtime, overview, trailer_key, watch_providers, cast_members, stills, revenue';

/** Films a hero appears in, richest-first (by appearance rank = issue_count). */
export async function getHeroFilms(heroId: string): Promise<HeroFilm[]> {
  const { data, error } = await supabase
    .from('hero_film_appearances')
    .select(`rank, films ( ${FILM_SELECT} )`)
    .eq('hero_id', heroId)
    .order('rank', { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  return (data as unknown as JoinRow[])
    .filter((r) => r.films !== null)
    .map((r) => filmRowToHeroFilm(r.films!));
}

/** Fetch a single film by TMDB ID. Returns null on error or not found. */
export async function getFilmById(tmdbId: string): Promise<HeroFilm | null> {
  const { data, error } = await supabase
    .from('films')
    .select(FILM_SELECT)
    .eq('tmdb_id', tmdbId)
    .single();

  if (error || !data) return null;
  return filmRowToHeroFilm(data as unknown as FilmRow);
}

/** Heroes that appear in a film, ordered by appearance rank desc. */
export async function getFilmHeroes(tmdbId: string): Promise<RelatedHeroCard[]> {
  const { data, error } = await supabase
    .from('hero_film_appearances')
    .select('heroes ( id, name, image_url, image_md_url, portrait_url, publisher, alignment )')
    .eq('tmdb_id', tmdbId)
    .order('rank', { ascending: false, nullsFirst: false })
    .limit(30);

  if (error || !data) return [];

  return (data as unknown as Array<{ heroes: RelatedHeroCard | null }>)
    .filter((r) => r.heroes !== null)
    .map((r) => r.heroes!);
}
```

- [ ] **Step 3: Verify TypeScript parses (no new errors)**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn tsc --noEmit 2>&1 | head -40
```

Expected: same set of pre-existing errors (StyleSheet.absoluteFillObject, splash), zero new errors from `films.ts`.

---

## Task 2: Update `__tests__/lib/db/films.test.ts` — tests for new helpers + update existing

**Files:**
- Modify: `__tests__/lib/db/films.test.ts`

- [ ] **Step 1: Replace test file with full coverage**

```typescript
import { getHeroFilms, getFilmById, getFilmHeroes, extractProviders, pickFeaturedFilm } from '../../../src/lib/db/films';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const BASE_FILM_ROW = {
  tmdb_id: '268',
  title: 'Batman',
  year: 1989,
  poster_url: 'p',
  backdrop_url: 'b',
  vote_average: 7.2,
  runtime: 126,
  overview: 'o',
  trailer_key: 'bbb',
  watch_providers: null,
  cast_members: null,
  stills: null,
  revenue: 411000000,
};

describe('getHeroFilms', () => {
  it('returns flattened, rank-ordered films for a hero including revenue', async () => {
    const rows = [{ rank: 50, films: BASE_FILM_ROW }];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const films = await getHeroFilms('69');
    expect(supabase.from).toHaveBeenCalledWith('hero_film_appearances');
    expect(films).toHaveLength(1);
    expect(films[0]).toMatchObject({ tmdbId: '268', title: 'Batman', year: 1989, trailerKey: 'bbb', revenue: 411000000 });
  });

  it('returns [] on error', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    expect(await getHeroFilms('1')).toEqual([]);
  });
});

describe('getFilmById', () => {
  it('returns mapped HeroFilm for a matching row', async () => {
    const single = jest.fn().mockResolvedValue({ data: BASE_FILM_ROW, error: null });
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const film = await getFilmById('268');
    expect(supabase.from).toHaveBeenCalledWith('films');
    expect(film).not.toBeNull();
    expect(film!.tmdbId).toBe('268');
    expect(film!.revenue).toBe(411000000);
  });

  it('returns null on error', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
    expect(await getFilmById('999')).toBeNull();
  });
});

describe('getFilmHeroes', () => {
  it('returns RelatedHeroCard array from join rows', async () => {
    const heroRow = { id: 'h1', name: 'Batman', image_url: null, image_md_url: null, portrait_url: null, publisher: 'DC', alignment: 'good' };
    const rows = [{ heroes: heroRow }, { heroes: null }];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const order = jest.fn(() => ({ limit }));
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const heroes = await getFilmHeroes('268');
    expect(heroes).toHaveLength(1);
    expect(heroes[0].name).toBe('Batman');
  });

  it('returns [] on error', async () => {
    const limit = jest.fn().mockResolvedValue({ data: null, error: { message: 'err' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) });
    expect(await getFilmHeroes('268')).toEqual([]);
  });
});

describe('extractProviders', () => {
  it('returns [] for null input', () => {
    expect(extractProviders(null)).toEqual([]);
  });

  it('maps logo_path to w92 URL', () => {
    const blob = {
      US: {
        flatrate: [{ provider_name: 'Netflix', logo_path: '/nfx.png' }],
      },
    };
    const result = extractProviders(blob);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/w92/nfx.png' });
  });

  it('sets logoUrl to null when logo_path is absent', () => {
    const blob = {
      US: {
        buy: [{ provider_name: 'Amazon', logo_path: null }],
      },
    };
    const result = extractProviders(blob);
    expect(result[0].logoUrl).toBeNull();
  });

  it('dedupes providers that appear in multiple categories', () => {
    const blob = {
      US: {
        flatrate: [{ provider_name: 'Disney+', logo_path: '/d.png' }],
        rent:     [{ provider_name: 'Disney+', logo_path: '/d.png' }],
      },
    };
    expect(extractProviders(blob)).toHaveLength(1);
  });

  it('prefers US over other regions', () => {
    const blob = {
      GB: { flatrate: [{ provider_name: 'BritBox', logo_path: '/b.png' }] },
      US: { flatrate: [{ provider_name: 'Netflix', logo_path: '/n.png' }] },
    };
    const result = extractProviders(blob);
    expect(result.map((p) => p.name)).toContain('Netflix');
    expect(result.map((p) => p.name)).not.toContain('BritBox');
  });

  it('falls back to first available region when US is absent', () => {
    const blob = {
      GB: { flatrate: [{ provider_name: 'BritBox', logo_path: '/b.png' }] },
    };
    const result = extractProviders(blob);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('BritBox');
  });
});

describe('pickFeaturedFilm', () => {
  const noBackdrop: import('../../../src/lib/db/films').HeroFilm = {
    tmdbId: '1', title: 'A', year: 2000, posterUrl: 'p', backdropUrl: null,
    voteAverage: null, runtime: null, overview: null, trailerKey: null,
    watchProviders: null, cast: null, stills: null, revenue: null,
  };
  const withBackdrop: import('../../../src/lib/db/films').HeroFilm = {
    ...noBackdrop, tmdbId: '2', title: 'B', backdropUrl: 'http://img.com/b.jpg',
  };

  it('returns null for empty array', () => {
    expect(pickFeaturedFilm([])).toBeNull();
  });

  it('prefers the first film with a backdropUrl', () => {
    expect(pickFeaturedFilm([noBackdrop, withBackdrop])).toBe(withBackdrop);
  });

  it('falls back to the first film when none have a backdrop', () => {
    expect(pickFeaturedFilm([noBackdrop])).toBe(noBackdrop);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn test:ci --testPathPattern="films.test" 2>&1 | tail -20
```

Expected: all tests pass (2 existing + ~13 new).

- [ ] **Step 3: Commit data layer**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && git add src/lib/db/films.ts __tests__/lib/db/films.test.ts && git commit -m "feat(db): extend films.ts with extractProviders, getFilmById, getFilmHeroes, pickFeaturedFilm, revenue field"
```

---

## Task 3: Create `src/components/film/FilmBackdropHeader.tsx`

**Files:**
- Create: `src/components/film/FilmBackdropHeader.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HeroFilm } from '../../lib/db/films';
import { COLORS } from '../../constants/colors';

function formatRevenue(n: number | null): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function FilmBackdropHeader({
  film,
  onBack,
}: {
  film: HeroFilm;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;

  const metaPills: string[] = [
    film.year ? String(film.year) : null,
    film.voteAverage != null ? `★ ${film.voteAverage.toFixed(1)}` : null,
    film.runtime ? `${film.runtime} min` : null,
    formatRevenue(film.revenue),
  ].filter((v): v is string => v !== null);

  return (
    <View style={styles.root}>
      {/* Backdrop */}
      {film.backdropUrl ? (
        <Image
          source={{ uri: film.backdropUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.backdropPlaceholder]} />
      )}

      {/* Dark gradient scrim */}
      <LinearGradient
        colors={['rgba(10,14,18,0.55)', 'rgba(10,14,18,0.72)', 'rgba(10,14,18,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Back button */}
      <TouchableOpacity
        onPress={onBack}
        style={[styles.backBtn, { top: insets.top + 12 }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Poster + meta row */}
      <View style={[styles.contentRow, wide && styles.contentRowWide, { paddingTop: insets.top + 56 }]}>
        {film.posterUrl ? (
          <View style={styles.posterShadow}>
            <View style={styles.posterClip}>
              <Image
                source={{ uri: film.posterUrl }}
                style={styles.poster}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          </View>
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={30} color="rgba(255,255,255,0.5)" />
          </View>
        )}

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={3}>{film.title}</Text>
          {metaPills.length > 0 ? (
            <View style={styles.pillRow}>
              {metaPills.map((p, i) => (
                <View key={i} style={styles.pill}>
                  <Text style={styles.pillText}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    minHeight: 280,
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  backdropPlaceholder: {
    backgroundColor: COLORS.navy,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    gap: 16,
  },
  contentRowWide: {
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%',
  },
  posterShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
    borderRadius: 10,
    flexShrink: 0,
  },
  posterClip: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  poster: {
    width: 100,
    height: 150,
  },
  posterPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    gap: 10,
    paddingBottom: 4,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: '#fff',
    lineHeight: 31,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
});
```

---

## Task 4: Create `src/components/film/FilmTrailer.tsx`

**Files:**
- Create: `src/components/film/FilmTrailer.tsx`

- [ ] **Step 1: Create the component**

Port the `TrailerSection` logic from the now-deleted `MovieDetailSheet.tsx`, with the same lazy WebView require + graceful fallback pattern:

```typescript
import { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

// Lazy require — avoids a hard crash when the module is not linked.
let WebView: React.ComponentType<{
  source: { uri: string };
  style?: object;
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
}> | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require('react-native-webview').WebView;
  } catch {
    // not linked — will fall back to Linking.openURL
  }
}

export function FilmTrailer({ trailerKey }: { trailerKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = `https://www.youtube.com/embed/${trailerKey}`;

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.btn} onPress={() => setExpanded(true)} activeOpacity={0.8}>
        <Ionicons name="play-circle" size={18} color="#fff" />
        <Text style={styles.btnText}>Watch Trailer</Text>
      </TouchableOpacity>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.frame}>
        {/* @ts-ignore — iframe is a web-only element */}
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: 'none', borderRadius: 10 }}
        />
      </View>
    );
  }

  if (WebView) {
    return (
      <View style={styles.frame}>
        <WebView
          source={{ uri: embedUrl }}
          style={styles.webView}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${trailerKey}`)}
      activeOpacity={0.8}
    >
      <Ionicons name="play-circle" size={18} color="#fff" />
      <Text style={styles.btnText}>Open Trailer</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
  },
  btnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
  },
  frame: {
    width: '100%',
    height: 210,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webView: { flex: 1 },
});
```

---

## Task 5: Create `src/components/film/WhereToWatch.tsx`

**Files:**
- Create: `src/components/film/WhereToWatch.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import type { WatchProvider } from '../../lib/db/films';

export function WhereToWatch({ providers }: { providers: WatchProvider[] }) {
  if (providers.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Where to Watch</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {providers.map((p) => (
          <View key={p.name} style={styles.chip}>
            {p.logoUrl ? (
              <Image
                source={{ uri: p.logoUrl }}
                style={styles.logo}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : null}
            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.navy + '12',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  name: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
    maxWidth: 100,
  },
});
```

---

## Task 6: Create `src/components/film/CastRail.tsx`

**Files:**
- Create: `src/components/film/CastRail.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { HeroFilmCastMember } from '../../lib/db/films';

export function CastRail({ cast }: { cast: HeroFilmCastMember[] }) {
  if (cast.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Cast</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cast.map((member, i) => (
          <View key={`${member.name}-${i}`} style={styles.member}>
            {member.profile_url ? (
              <Image
                source={{ uri: member.profile_url }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color={COLORS.grey} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>{member.name}</Text>
            {member.character ? (
              <Text style={styles.character} numberOfLines={2}>{member.character}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  row: {
    gap: 12,
    paddingHorizontal: 20,
  },
  member: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.navy + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 13,
  },
  character: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 12,
  },
});
```

---

## Task 7: Create `src/components/film/StillsGallery.tsx`

**Files:**
- Create: `src/components/film/StillsGallery.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { ImageLightbox } from '../ImageLightbox';

export function StillsGallery({ stills }: { stills: string[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (stills.length === 0) return null;

  const images = stills.map((url) => ({ url }));

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Stills</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {stills.map((url, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.85}
            onPress={() => setLightboxIndex(i)}
          >
            <Image
              source={{ uri: url }}
              style={styles.still}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {lightboxIndex !== null ? (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  row: {
    gap: 8,
    paddingHorizontal: 20,
  },
  still: {
    width: 192,
    height: 108,
    borderRadius: 8,
  },
});
```

---

## Task 8: Create `src/components/film/HeroesInFilmRail.tsx`

**Files:**
- Create: `src/components/film/HeroesInFilmRail.tsx`

Mirror `RelatedHeroStrip`'s card dimensions and `HeroImage` usage.

- [ ] **Step 1: Create the component**

```typescript
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { RelatedHeroCard } from '../../lib/db/heroes';

const CARD_W = 104;
const CARD_H = 140;

export function HeroesInFilmRail({ heroes }: { heroes: RelatedHeroCard[] }) {
  const router = useRouter();
  if (heroes.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Heroes in this Film</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {heroes.map((hero) => (
          <TouchableOpacity
            key={hero.id}
            activeOpacity={0.85}
            onPress={() => router.push(`/character/${hero.id}?name=${encodeURIComponent(hero.name)}`)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`View ${hero.name}`}
          >
            <HeroImage
              id={hero.id}
              name={hero.name}
              imageUrl={hero.image_url}
              portraitUrl={hero.portrait_url}
              imageMdUrl={hero.image_md_url}
              grid
              contentFit="cover"
              contentPosition="top"
              style={styles.cardImage}
              recyclingKey={hero.id}
              transition={150}
            />
            <LinearGradient
              colors={['transparent', 'rgba(20,28,32,0.9)']}
              locations={[0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.cardName} numberOfLines={2}>{hero.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  row: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 2,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    boxShadow: '0px 4px 10px rgba(41,60,67,0.22)',
  },
  cardImage: { position: 'absolute', top: 0, left: 0, width: CARD_W, height: CARD_H },
  cardName: {
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    lineHeight: 14,
    color: COLORS.beige,
    paddingHorizontal: 9,
    paddingBottom: 9,
  },
});
```

---

## Task 9: Create `app/film/[tmdbId].tsx` — full-screen film route

**Files:**
- Create: `app/film/[tmdbId].tsx`

- [ ] **Step 1: Create the app/film directory and file**

```bash
mkdir -p /Users/ginoswanepoel/Documents/Code/hero/app/film
```

- [ ] **Step 2: Write the route**

```typescript
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFilmById, getFilmHeroes, extractProviders } from '../../src/lib/db/films';
import type { HeroFilm } from '../../src/lib/db/films';
import type { RelatedHeroCard } from '../../src/lib/db/heroes';
import { COLORS } from '../../src/constants/colors';
import { NotFoundView } from '../../src/components/NotFoundView';
import { FilmBackdropHeader } from '../../src/components/film/FilmBackdropHeader';
import { FilmTrailer } from '../../src/components/film/FilmTrailer';
import { WhereToWatch } from '../../src/components/film/WhereToWatch';
import { CastRail } from '../../src/components/film/CastRail';
import { StillsGallery } from '../../src/components/film/StillsGallery';
import { HeroesInFilmRail } from '../../src/components/film/HeroesInFilmRail';

export default function FilmScreen() {
  const { tmdbId } = useLocalSearchParams<{ tmdbId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;

  const [film, setFilm] = useState<HeroFilm | null | undefined>(undefined); // undefined = loading, null = not found
  const [heroes, setHeroes] = useState<RelatedHeroCard[]>([]);

  useEffect(() => {
    if (!tmdbId) { setFilm(null); return; }
    let active = true;
    getFilmById(tmdbId).then((f) => { if (active) setFilm(f); });
    getFilmHeroes(tmdbId).then((h) => { if (active) setHeroes(h); });
    return () => { active = false; };
  }, [tmdbId]);

  if (film === undefined) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (film === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <NotFoundView
          stamp="Missing"
          stampColor={COLORS.red}
          icon="film-outline"
          headline="Film not found"
          subline="We don't have this film in the archive yet."
          actions={[{ label: 'Go back', primary: true, onPress: () => router.back() }]}
        />
      </View>
    );
  }

  const providers = extractProviders(film.watchProviders);

  const tmdbUrl = `https://www.themoviedb.org/movie/${film.tmdbId}`;

  const content = (
    <>
      {/* Overview */}
      {film.overview ? (
        <View style={styles.section}>
          <Text style={styles.overview}>{film.overview}</Text>
        </View>
      ) : null}

      {/* Trailer */}
      {film.trailerKey ? (
        <View style={styles.section}>
          <FilmTrailer trailerKey={film.trailerKey} />
        </View>
      ) : null}

      {/* Where to Watch */}
      {providers.length > 0 ? (
        <View style={styles.railSection}>
          <WhereToWatch providers={providers} />
        </View>
      ) : null}

      {/* Cast */}
      {film.cast && film.cast.length > 0 ? (
        <View style={styles.railSection}>
          <CastRail cast={film.cast} />
        </View>
      ) : null}

      {/* Stills */}
      {film.stills && film.stills.length > 0 ? (
        <View style={styles.railSection}>
          <StillsGallery stills={film.stills} />
        </View>
      ) : null}

      {/* Heroes in Film */}
      {heroes.length > 0 ? (
        <View style={styles.railSection}>
          <HeroesInFilmRail heroes={heroes} />
        </View>
      ) : null}

      {/* TMDB link */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => Linking.openURL(tmdbUrl)}
          activeOpacity={0.8}
        >
          <Ionicons name="open-outline" size={14} color="#fff" />
          <Text style={styles.linkBtnText}>View on TMDB</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <FilmBackdropHeader film={film} onBack={() => router.back()} />

        {wide ? (
          // Two-column desktop layout: left col ~300px (trailer), right col (meta)
          <View style={styles.desktopRow}>
            <View style={styles.desktopLeft}>
              {film.trailerKey ? (
                <View style={styles.sectionNoPad}>
                  <FilmTrailer trailerKey={film.trailerKey} />
                </View>
              ) : null}
            </View>
            <View style={styles.desktopRight}>
              {film.overview ? (
                <View style={styles.sectionNoPad}>
                  <Text style={styles.overview}>{film.overview}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            {film.overview ? (
              <View style={styles.section}>
                <Text style={styles.overview}>{film.overview}</Text>
              </View>
            ) : null}
            {film.trailerKey ? (
              <View style={styles.section}>
                <FilmTrailer trailerKey={film.trailerKey} />
              </View>
            ) : null}
          </>
        )}

        {providers.length > 0 ? (
          <View style={styles.railSection}>
            <WhereToWatch providers={providers} />
          </View>
        ) : null}

        {film.cast && film.cast.length > 0 ? (
          <View style={styles.railSection}>
            <CastRail cast={film.cast} />
          </View>
        ) : null}

        {film.stills && film.stills.length > 0 ? (
          <View style={styles.railSection}>
            <StillsGallery stills={film.stills} />
          </View>
        ) : null}

        {heroes.length > 0 ? (
          <View style={styles.railSection}>
            <HeroesInFilmRail heroes={heroes} />
          </View>
        ) : null}

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL(tmdbUrl)}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={14} color="#fff" />
            <Text style={styles.linkBtnText}>View on TMDB</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  loading: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionNoPad: {
    paddingTop: 20,
  },
  railSection: {
    paddingTop: 20,
  },
  overview: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy + 'bb',
    lineHeight: 22,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    backgroundColor: COLORS.orange,
    borderRadius: 14,
  },
  linkBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.2,
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 20,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  desktopLeft: {
    width: 300,
  },
  desktopRight: {
    flex: 1,
  },
});
```

- [ ] **Step 3: Run tsc to verify no new errors**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn tsc --noEmit 2>&1 | head -60
```

---

## Task 10: Redesign `src/components/MovieStrip.tsx` — landscape backdrop card, router.push, remove sheet

**Files:**
- Modify: `src/components/MovieStrip.tsx`

- [ ] **Step 1: Read the current file again to confirm current state**

The file imports `MovieDetailSheet` and uses `selectedItem` state to open it. The strip normalises films + movies into `StripItem`. The featured card is a taller poster card. We need to:
1. Replace the `selectedItem` / `MovieDetailSheet` pattern with `router.push('/film/' + tmdbId)`.
2. Add a landscape backdrop `FeaturedFilmCard` for the films path that uses `backdropUrl`.
3. Keep the legacy movie path using `Linking.openURL`.
4. For films overflow ("+N more"), toggle `showAll` state instead of opening `MovieGridModal`.
5. Keep `MovieGridModal` for the legacy movies overflow.

- [ ] **Step 2: Replace the full file**

```typescript
import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';
import { MovieGridModal } from './MovieGridModal';
import type { HeroFilm } from '../lib/db/films';
import { pickFeaturedFilm } from '../lib/db/films';

const CARD_W = 100;
const CARD_H = 150;
const INITIAL_COUNT = 10;

// Landscape backdrop card dimensions (films with a backdropUrl)
const BACKDROP_W = 220;
const BACKDROP_H = 150;

interface StripItem {
  key: string;
  title: string;
  year: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  hasTrailer: boolean;
  film?: HeroFilm;
  movie?: MovieAppearance;
}

interface Props {
  films?: HeroFilm[];
  movies?: MovieAppearance[];
  totalCount: number;
  contentInset?: number;
  bleedMargin?: number;
}

function sortItems(items: StripItem[]): StripItem[] {
  return [...items].sort((a, b) => {
    if (!a.year && !b.year) return 0;
    if (!a.year) return 1;
    if (!b.year) return -1;
    return parseInt(b.year) - parseInt(a.year);
  });
}

function buildItems(films?: HeroFilm[], movies?: MovieAppearance[]): StripItem[] {
  if (films && films.length > 0) {
    return films.map((f) => ({
      key: f.tmdbId,
      title: f.title,
      year: f.year ? String(f.year) : null,
      posterUrl: f.posterUrl,
      backdropUrl: f.backdropUrl,
      voteAverage: f.voteAverage,
      hasTrailer: !!f.trailerKey,
      film: f,
    }));
  }
  if (movies && movies.length > 0) {
    return movies.map((m) => ({
      key: m.name,
      title: m.name,
      year: m.year ?? null,
      posterUrl: m.imageUrl ?? null,
      backdropUrl: null,
      voteAverage: null,
      hasTrailer: false,
      movie: m,
    }));
  }
  return [];
}

/** Landscape backdrop card — used for the top film when it has a backdropUrl. */
function FeaturedFilmCard({ item, onPress }: { item: StripItem; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const webHoverProps =
    Platform.OS === 'web'
      ? ({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object)
      : {};

  return (
    <Pressable
      style={({ pressed }) => [styles.backdropCard, (pressed || hovered) && styles.cardActive]}
      onPress={onPress}
      {...webHoverProps}
    >
      {item.backdropUrl ? (
        <Image
          source={{ uri: item.backdropUrl }}
          style={styles.backdropImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.backdropImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.backdropImage, styles.placeholder]}>
          <Ionicons name="film-outline" size={28} color={COLORS.grey} />
        </View>
      )}

      {/* Bottom gradient + title overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(20,28,32,0.85)']}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.backdropMeta}>
        <Text style={styles.backdropTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.backdropPillRow}>
          {item.year ? (
            <Text style={styles.backdropPill}>{item.year}</Text>
          ) : null}
          {item.voteAverage != null ? (
            <Text style={styles.backdropPill}>★ {item.voteAverage.toFixed(1)}</Text>
          ) : null}
        </View>
      </View>

      {item.hasTrailer ? (
        <View style={styles.trailerBadge}>
          <Ionicons name="play-circle" size={22} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Standard portrait poster card for non-featured items. */
function StripCard({ item, onPress }: { item: StripItem; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const webHoverProps =
    Platform.OS === 'web'
      ? ({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object)
      : {};

  return (
    <Pressable
      style={({ pressed }) => [styles.card, (pressed || hovered) && styles.cardActive]}
      onPress={onPress}
      {...webHoverProps}
    >
      <View style={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image
            source={{ uri: item.posterUrl }}
            style={{ width: CARD_W, height: CARD_H }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.placeholder, { width: CARD_W, height: CARD_H }]}>
            <Ionicons name="film-outline" size={22} color={COLORS.grey} />
            <Text style={[styles.placeholderName, { width: CARD_W - 16 }]} numberOfLines={3}>
              {item.title}
            </Text>
          </View>
        )}

        {/* ★ rating chip — top-left */}
        {item.voteAverage != null ? (
          <View style={styles.ratingChip}>
            <Text style={styles.ratingChipText}>★ {item.voteAverage.toFixed(1)}</Text>
          </View>
        ) : null}

        {/* Trailer play badge — top-right */}
        {item.hasTrailer ? (
          <View style={styles.trailerBadge}>
            <Ionicons name="play-circle" size={22} color="#fff" />
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { width: CARD_W }]} numberOfLines={2}>{item.title}</Text>
      {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
    </Pressable>
  );
}

export function MovieStrip({ films, movies, totalCount, contentInset = 16, bleedMargin = 0 }: Props) {
  const router = useRouter();
  const [gridVisible, setGridVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const allItems = buildItems(films, movies);
  const sorted = sortItems(allItems);

  const isFilmsPath = !!(films && films.length > 0);

  // For the films path: featured film uses backdrop card (if any film has one)
  const featuredFilm = isFilmsPath ? pickFeaturedFilm(films ?? []) : null;
  const featuredItem = featuredFilm
    ? sorted.find((it) => it.film?.tmdbId === featuredFilm.tmdbId)
    : null;
  const restItems = featuredItem
    ? sorted.filter((it) => it !== featuredItem)
    : sorted.slice(1);
  const legacyFeatured = !featuredItem ? sorted[0] : null;

  const cappedRest = isFilmsPath
    ? (showAll ? restItems : restItems.slice(0, INITIAL_COUNT - 1))
    : restItems.slice(0, INITIAL_COUNT - 1);

  const filmOverflow = isFilmsPath && !showAll && restItems.length > INITIAL_COUNT - 1
    ? restItems.length - (INITIAL_COUNT - 1)
    : 0;
  const legacyOverflow = !isFilmsPath
    ? totalCount - Math.min(sorted.length, INITIAL_COUNT)
    : 0;

  const legacyMovies: MovieAppearance[] = sorted
    .filter((it) => it.movie != null)
    .map((it) => it.movie!);

  const handlePress = (item: StripItem) => {
    if (item.film) {
      router.push(`/film/${item.film.tmdbId}`);
    } else if (item.movie) {
      const url = item.movie.url ?? `https://www.google.com/search?q=${encodeURIComponent(item.title + ' film')}`;
      Linking.openURL(url);
    }
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={bleedMargin ? { marginHorizontal: -bleedMargin } : undefined}
        contentContainerStyle={[styles.container, { paddingHorizontal: contentInset }]}
      >
        {/* Featured card: landscape backdrop (films) or poster (legacy) */}
        {featuredItem ? (
          <FeaturedFilmCard item={featuredItem} onPress={() => handlePress(featuredItem)} />
        ) : legacyFeatured ? (
          <StripCard item={legacyFeatured} onPress={() => handlePress(legacyFeatured)} />
        ) : null}

        {cappedRest.map((item, i) => (
          <StripCard key={item.key + i} item={item} onPress={() => handlePress(item)} />
        ))}

        {/* Films overflow: reveal all in-place */}
        {filmOverflow > 0 ? (
          <Pressable
            style={[styles.card, styles.overflowCard]}
            onPress={() => setShowAll(true)}
          >
            <Text style={styles.overflowCount}>+{filmOverflow}</Text>
            <Text style={styles.overflowLabel}>more</Text>
          </Pressable>
        ) : null}

        {/* Legacy movies overflow: open grid modal */}
        {legacyOverflow > 0 ? (
          <Pressable
            style={[styles.card, styles.overflowCard]}
            onPress={() => setGridVisible(true)}
          >
            <Text style={styles.overflowCount}>+{legacyOverflow}</Text>
            <Text style={styles.overflowLabel}>more</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {gridVisible && legacyMovies.length > 0 ? (
        <MovieGridModal
          movies={legacyMovies}
          onClose={() => setGridVisible(false)}
          onSelectMovie={(movie) => {
            setGridVisible(false);
            const url = movie.url ?? `https://www.google.com/search?q=${encodeURIComponent(movie.name + ' film')}`;
            Linking.openURL(url);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  // Landscape backdrop card
  backdropCard: {
    width: BACKDROP_W,
    height: BACKDROP_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  backdropImage: {
    width: BACKDROP_W,
    height: BACKDROP_H,
  },
  backdropMeta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    gap: 4,
  },
  backdropTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: '#fff',
    lineHeight: 17,
  },
  backdropPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  backdropPill: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  // Standard portrait card
  card: {
    width: CARD_W,
    alignItems: 'center',
  },
  cardActive: { opacity: 0.8 },
  posterWrapper: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  placeholder: {
    backgroundColor: COLORS.navy + '18',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  placeholderName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    textAlign: 'center',
    opacity: 0.65,
    paddingHorizontal: 4,
  },
  ratingChip: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  ratingChipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 8,
    color: '#fff',
    letterSpacing: 0.2,
  },
  trailerBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  title: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 14,
  },
  year: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.grey,
    marginTop: 2,
    textAlign: 'center',
  },
  overflowCard: {
    height: CARD_H + 6 + 14 + 2 + 12,
    justifyContent: 'center',
    backgroundColor: COLORS.navy + '0f',
    borderRadius: 8,
  },
  overflowCount: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
    textAlign: 'center',
  },
  overflowLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textAlign: 'center',
  },
});
```

---

## Task 11: Delete `MovieDetailSheet.tsx` and clean up imports

**Files:**
- Delete: `src/components/MovieDetailSheet.tsx`
- Verify: `app/character/[id].tsx` has no lingering import

- [ ] **Step 1: Grep for MovieDetailSheet references**

```bash
grep -r "MovieDetailSheet" /Users/ginoswanepoel/Documents/Code/hero/src /Users/ginoswanepoel/Documents/Code/hero/app 2>/dev/null
```

Expected output: one result in `src/components/MovieStrip.tsx` (which no longer imports it after Task 10) and the file itself. The `app/character/[id].tsx` never imported `MovieDetailSheet` directly — it only imported `MovieStrip`. Confirm the grep output shows no remaining references besides the file itself.

- [ ] **Step 2: Delete the file**

```bash
rm /Users/ginoswanepoel/Documents/Code/hero/src/components/MovieDetailSheet.tsx
```

- [ ] **Step 3: Verify the character screen still compiles**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn tsc --noEmit 2>&1 | grep -i "MovieDetail"
```

Expected: no output (no errors referencing MovieDetailSheet).

---

## Task 12: Run full test suite and tsc, then commit

- [ ] **Step 1: Run all tests**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn test:ci 2>&1 | tail -30
```

Expected: all tests pass. The films tests should now include all new test cases.

- [ ] **Step 2: Run tsc**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && yarn tsc --noEmit 2>&1
```

Expected: same pre-existing errors only (StyleSheet.absoluteFillObject, splash). Zero new errors.

- [ ] **Step 3: Commit film route and components**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && git add app/film/ src/components/film/ && git commit -m "feat(ui): add full-screen film route (app/film/[tmdbId]) with backdrop header, trailer, cast, stills, heroes rails"
```

- [ ] **Step 4: Commit strip redesign + delete sheet**

```bash
cd /Users/ginoswanepoel/Documents/Code/hero && git add src/components/MovieStrip.tsx && git rm src/components/MovieDetailSheet.tsx && git commit -m "feat(ui): redesign MovieStrip with backdrop featured card + router.push; delete MovieDetailSheet modal"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task covering it |
|---|---|
| `extractProviders` with logos, US preference, deduplication | Task 1 + Task 2 |
| `getFilmById` returning `HeroFilm | null` | Task 1 + Task 2 |
| `getFilmHeroes` returning `RelatedHeroCard[]` | Task 1 + Task 2 |
| `pickFeaturedFilm` | Task 1 + Task 2 |
| `revenue` field added to `HeroFilm` + selected in both queries | Task 1 |
| Full-screen film route `app/film/[tmdbId].tsx` | Task 9 |
| `headerShown: false` + top-level ScrollView (no Pressable wrapper) | Task 9 |
| Loading and not-found states | Task 9 |
| Responsive wide layout | Task 9 |
| `FilmBackdropHeader` with gradient, poster, pills, back button, insets | Task 3 |
| `FilmTrailer` (iframe / WebView / Linking) | Task 4 |
| `WhereToWatch` with logo chips | Task 5 |
| `CastRail` full-bleed horizontal, circular avatars | Task 6 |
| `StillsGallery` + ImageLightbox | Task 7 |
| `HeroesInFilmRail` → `router.push('/character/…')` | Task 8 |
| Section order: backdrop → overview → trailer → providers → cast → stills → heroes | Task 9 |
| Landscape backdrop featured card in MovieStrip | Task 10 |
| `★rating` chip on poster cards | Task 10 |
| Film press → `router.push('/film/' + tmdbId)` | Task 10 |
| Legacy movie press → `Linking.openURL` | Task 10 |
| Films "+N more" → `showAll` toggle (no modal) | Task 10 |
| Legacy "+N more" → `MovieGridModal` | Task 10 |
| Delete `MovieDetailSheet.tsx` | Task 11 |
| Tests: `extractProviders`, `getFilmById`, `getFilmHeroes`, `pickFeaturedFilm` | Task 2 |
| Tests: existing `getHeroFilms` updated for `revenue` field | Task 2 |
| `yarn test:ci` + `yarn tsc --noEmit` passing | Task 12 |
| 2-3 logical commits | Tasks 2, 12 |

### Potential concerns

1. **`getFilmHeroes` join direction**: The query `supabase.from('hero_film_appearances').select('heroes ( … )').eq('tmdb_id', tmdbId)` relies on the `hero_film_appearances` table having a FK relationship to `heroes` (on `hero_id`) and also having a `tmdb_id` column. If the FK is on `films` (via `film_id` not `tmdb_id`), the query needs adjustment. Inspect the actual table schema if heroes come back empty.

2. **`app/film/[tmdbId].tsx` duplicate content sections**: In the wide desktop path the overview + trailer render in the two-column block; in mobile they render below that block. Since we use an `if (wide)` branch the sections only render once per path. No duplication issue.

3. **`useEffect` dependency**: The `content` variable was removed from the JSX to avoid duplicating sections — each section is inlined directly in the ScrollView tree (both the mobile and wide paths). This is clean.

4. **`boxShadow` in `HeroesInFilmRail`**: This is a React Native Web CSS prop (also used in `RelatedHeroStrip`), mirrored exactly from `RelatedHeroStrip.tsx`. No new issues introduced.
