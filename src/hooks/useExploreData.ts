import { useCallback, useEffect, useState } from 'react';
import {
  getSpotlightHeroes,
  getIconicHeroes,
  getTrendingSpotlightHeroes,
  getBrowseCovers,
  getNewlyAddedCV,
  getTopRivalries,
  getHeroCount,
  type Hero,
  type BrowseCover,
  type CategorySlug,
  type Rivalry,
} from '../lib/db/heroes';
import { getUserFavouriteHeroes } from '../lib/db/favourites';
import {
  getTrendingTitles,
  getTrendingOnScreen,
  getTrendingHeroesWiki,
  getActiveCampaigns,
  getTrendingForUser,
  type TrendingTitle,
  type WikiTrendingHero,
  type Campaign,
  type TrendingTitleCharacter,
} from '../lib/db/trending';
import { getNewComics, type NewComic } from '../lib/db/comics';
import { getDebutsThisMonth, type DebutIssue } from '../lib/db/anniversaries';
import { getTodaysMatchup, type TodaysMatchup } from '../lib/matchup';
import { getRecentlyViewed } from '../lib/db/viewHistory';
import { BROWSE_PODS } from '../components/home/CategoryPodGrid';
import { useAuth } from './useAuth';
import type { FavouriteHero } from '../types';

// Fetch a generous spotlight pool; each view slices to its own size (native 5,
// web sizes responsively). Keeping the larger pool here preserves web's
// rotation/variety without re-fetching.
const SPOTLIGHT_POOL = 10;

export interface ExploreData {
  /** True once the spotlight billboard has resolved — both views gate their
   *  skeleton on this. */
  started: boolean;
  // Billboard, the canon (Hall of Fame), fresh arrivals, the featured rivalry, and
  // the browse-grid covers. The full category/editorial lists are gone — those
  // modules are now grid tiles or live on their own destination pages.
  spotlight: Hero[];
  iconic: Hero[];
  newlyAdded: Hero[];
  rivalries: Rivalry[];
  browseCovers: Record<string, BrowseCover>;
  // Right-now / trending.
  trendingOnScreen: TrendingTitle[];
  wikiTrending: WikiTrendingHero[];
  debutsThisMonth: DebutIssue[];
  onScreen: TrendingTitle[];
  comingSoon: TrendingTitle[];
  streaming: TrendingTitle[];
  campaigns: Campaign[];
  newComics: NewComic[];
  /** `undefined` while loading, `null` when there's no matchup today. */
  matchup: TodaysMatchup | null | undefined;
  /** `null` while loading; a count once resolved. */
  heroCount: number | null;
  // Personalised (re-fetched when the signed-in user changes).
  trendingForUser: TrendingTitleCharacter[];
  recentlyViewed: FavouriteHero[];
  favourites: FavouriteHero[];
}

const INITIAL: ExploreData = {
  started: false,
  spotlight: [],
  iconic: [],
  newlyAdded: [],
  rivalries: [],
  browseCovers: {},
  trendingOnScreen: [],
  wikiTrending: [],
  debutsThisMonth: [],
  onScreen: [],
  comingSoon: [],
  streaming: [],
  campaigns: [],
  newComics: [],
  matchup: undefined,
  heroCount: null,
  trendingForUser: [],
  recentlyViewed: [],
  favourites: [],
};

// ── Cross-navigation cache ────────────────────────────────────────────────────
// The home screen owns ~30 independent fetches. Without a cache, every remount
// (e.g. back-navigation from a character) cold-refetches the lot and re-shows the
// skeleton — slow and redundant. This mirrors React Query's staleTime behaviour
// (used everywhere else in the app): seed instantly from the last snapshot, skip
// the network if it's still fresh, otherwise revalidate IN PLACE (no skeleton,
// since `started` is already true from the seed).
const EXPLORE_TTL = 1000 * 60 * 5; // 5 min, matching the app's query staleTime
let cachedExplore: ExploreData | null = null;
let cachedExploreAt = 0;

/**
 * Platform-neutral data layer for the Explore/Home screen. Owns every catalogue,
 * editorial, trending, and personalised fetch and returns one flat snapshot.
 * Both `app/(tabs)/explore.tsx` (native, virtualised FlatList) and
 * `explore.web.tsx` (web grid) consume it; each keeps its own presentation.
 *
 * Loaders use the more mature limits from the two prior implementations. The
 * previously web-only stat-pod / publisher-count fetches were dropped — they were
 * fetched but never rendered.
 */
export function useExploreData(): ExploreData {
  const { user } = useAuth();
  // Seed from the last snapshot so a remount paints instantly (no skeleton).
  const [data, setData] = useState<ExploreData>(() => cachedExplore ?? INITIAL);

  const set = useCallback(
    <K extends keyof ExploreData>(key: K) =>
      (val: ExploreData[K]) =>
        setData((d) => ({ ...d, [key]: val })),
    [],
  );

  // Keep the module snapshot current so the next mount can seed from it.
  useEffect(() => {
    cachedExplore = data;
  }, [data]);

  // Mount: billboard + catalogue + editorial + trending. Each query is
  // independent and fills its row as it resolves; only the spotlight (which gates
  // the skeleton) is awaited as a group.
  useEffect(() => {
    // Fresh cache → already seeded above; skip the cold fan-out entirely.
    if (cachedExplore?.started && Date.now() - cachedExploreAt < EXPLORE_TTL) return;
    // Lead the billboard with up to 2 characters on screen right now, then fill
    // with the curated spotlight pool (deduped). Views slice to their own size.
    // allSettled (not Promise.all): a flaky trending RPC must NOT zero out the
    // whole billboard — Promise.all rejects if either source fails, which left the
    // carousel empty (and cached empty) until a hard refresh.
    Promise.allSettled([getTrendingSpotlightHeroes(2), getSpotlightHeroes(SPOTLIGHT_POOL)]).then(
      ([trendRes, baseRes]) => {
        const trend = trendRes.status === 'fulfilled' ? trendRes.value : [];
        const base = baseRes.status === 'fulfilled' ? baseRes.value : [];
        const seen = new Set<string>();
        const merged: Hero[] = [];
        for (const h of [...trend, ...base]) {
          if (!seen.has(h.id)) {
            seen.add(h.id);
            merged.push(h);
          }
        }
        // Only mark the cache fresh once we actually have a billboard, so a total
        // failure retries on the next mount instead of sticking for the full TTL.
        if (merged.length > 0) cachedExploreAt = Date.now();
        setData((d) => ({ ...d, spotlight: merged, started: true }));
      },
    );

    getActiveCampaigns()
      .then(set('campaigns'))
      .catch(() => {});
    getTodaysMatchup()
      .then(set('matchup'))
      .catch(() => set('matchup')(null));
    getHeroCount()
      .then(set('heroCount'))
      .catch(() => {});

    getIconicHeroes(25)
      .then(set('iconic'))
      .catch(() => {});
    getBrowseCovers(BROWSE_PODS.map((p) => p.slug as CategorySlug))
      .then(set('browseCovers'))
      .catch(() => {});
    getTrendingOnScreen(12)
      .then(set('trendingOnScreen'))
      .catch(() => {});
    getTrendingHeroesWiki(14)
      .then(set('wikiTrending'))
      .catch(() => {});
    getDebutsThisMonth(14)
      .then(set('debutsThisMonth'))
      .catch(() => {});
    getTrendingTitles('on_screen', 6)
      .then(set('onScreen'))
      .catch(() => {});
    getTrendingTitles('coming_soon', 6)
      .then(set('comingSoon'))
      .catch(() => {});
    getTrendingTitles('streaming', 6)
      .then(set('streaming'))
      .catch(() => {});
    getNewComics(12)
      .then(set('newComics'))
      .catch(() => {});

    // Fresh catalogue arrivals (the one browse rail that isn't a grid tile).
    getNewlyAddedCV(25)
      .then(set('newlyAdded'))
      .catch(() => {});

    // The featured rivalry that opens the Arena chapter.
    getTopRivalries(12)
      .then(set('rivalries'))
      .catch(() => {});
  }, [set]);

  // Personalised rows — refetch when the signed-in user changes.
  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id)
      .then(set('recentlyViewed'))
      .catch(() => {});
    getUserFavouriteHeroes(user.id)
      .then(set('favourites'))
      .catch(() => {});
    getTrendingForUser(user.id)
      .then(set('trendingForUser'))
      .catch(() => {});
  }, [user?.id, set]);

  return data;
}
