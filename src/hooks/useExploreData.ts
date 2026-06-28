import { useCallback, useEffect, useState } from 'react';
import {
  getSpotlightHeroes,
  getIconicHeroes,
  getTrendingSpotlightHeroes,
  getBrowseCovers,
  getVillains,
  getAntiHeroes,
  getXMen,
  getNewlyAddedCV,
  getFranchiseIcons,
  getHeroesByPublisher,
  getHeroesByMediaTag,
  getHeroesByStatRanking,
  getTopRivalries,
  getMostFeared,
  getEraTimeline,
  getFirstAppearanceCovers,
  getHeroCount,
  type Hero,
  type BrowseCover,
  type CategorySlug,
  type Rivalry,
  type FearedVillain,
  type EraBucket,
  type FirstAppearanceCover,
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
  // Billboard + curated catalogue rows.
  spotlight: Hero[];
  iconic: Hero[];
  villains: Hero[];
  horror: Hero[];
  antiHeroes: Hero[];
  marvel: Hero[];
  dc: Hero[];
  strongest: Hero[];
  mostIntelligent: Hero[];
  xmen: Hero[];
  anime: Hero[];
  videoGames: Hero[];
  franchiseIcons: Hero[];
  newlyAdded: Hero[];
  // Editorial features.
  rivalries: Rivalry[];
  mostFeared: FearedVillain[];
  eras: EraBucket[];
  covers: FirstAppearanceCover[];
  browseCovers: Record<string, BrowseCover>;
  // Right-now / trending.
  trendingOnScreen: TrendingTitle[];
  wikiTrending: WikiTrendingHero[];
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
  villains: [],
  horror: [],
  antiHeroes: [],
  marvel: [],
  dc: [],
  strongest: [],
  mostIntelligent: [],
  xmen: [],
  anime: [],
  videoGames: [],
  franchiseIcons: [],
  newlyAdded: [],
  rivalries: [],
  mostFeared: [],
  eras: [],
  covers: [],
  browseCovers: {},
  trendingOnScreen: [],
  wikiTrending: [],
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
  const [data, setData] = useState<ExploreData>(INITIAL);

  const set = useCallback(
    <K extends keyof ExploreData>(key: K) =>
      (val: ExploreData[K]) =>
        setData((d) => ({ ...d, [key]: val })),
    [],
  );

  // Mount: billboard + catalogue + editorial + trending. Each query is
  // independent and fills its row as it resolves; only the spotlight (which gates
  // the skeleton) is awaited as a group.
  useEffect(() => {
    // Lead the billboard with up to 2 characters on screen right now, then fill
    // with the curated spotlight pool (deduped). Views slice to their own size.
    Promise.all([getSpotlightHeroes(SPOTLIGHT_POOL), getTrendingSpotlightHeroes(2)])
      .then(([base, trend]) => {
        const seen = new Set<string>();
        const merged: Hero[] = [];
        for (const h of [...trend, ...base]) {
          if (!seen.has(h.id)) {
            seen.add(h.id);
            merged.push(h);
          }
        }
        setData((d) => ({ ...d, spotlight: merged, started: true }));
      })
      .catch(() => setData((d) => ({ ...d, started: true })));

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

    // Curated catalogue rows.
    getVillains(25)
      .then(set('villains'))
      .catch(() => {});
    getHeroesByMediaTag('horror-icon', 25)
      .then(set('horror'))
      .catch(() => {});
    getAntiHeroes(20)
      .then(set('antiHeroes'))
      .catch(() => {});
    getHeroesByPublisher('marvel', 25)
      .then(set('marvel'))
      .catch(() => {});
    getHeroesByPublisher('dc', 25)
      .then(set('dc'))
      .catch(() => {});
    getHeroesByStatRanking('strength', 20)
      .then(set('strongest'))
      .catch(() => {});
    getHeroesByStatRanking('intelligence', 20)
      .then(set('mostIntelligent'))
      .catch(() => {});
    getXMen(25)
      .then(set('xmen'))
      .catch(() => {});
    getHeroesByMediaTag('anime', 25)
      .then(set('anime'))
      .catch(() => {});
    getHeroesByMediaTag('video-game', 25)
      .then(set('videoGames'))
      .catch(() => {});
    getFranchiseIcons(25)
      .then(set('franchiseIcons'))
      .catch(() => {});
    getNewlyAddedCV(25)
      .then(set('newlyAdded'))
      .catch(() => {});

    // Editorial features.
    getTopRivalries(12)
      .then(set('rivalries'))
      .catch(() => {});
    getMostFeared(12)
      .then(set('mostFeared'))
      .catch(() => {});
    getEraTimeline(8)
      .then(set('eras'))
      .catch(() => {});
    getFirstAppearanceCovers(14)
      .then(set('covers'))
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
