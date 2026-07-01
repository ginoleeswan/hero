import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from '../db/heroes';
import { getUserFavouriteHeroes } from '../db/favourites';
import {
  getTrendingTitlesMulti,
  getTrendingOnScreen,
  getTrendingHeroesWiki,
  getActiveCampaigns,
  getTrendingForUser,
  type TrendingTitle,
  type WikiTrendingHero,
  type Campaign,
  type TrendingTitleCharacter,
} from '../db/trending';
import { getNewComics, type NewComic } from '../db/comics';
import { getDebutsThisMonth, type DebutIssue } from '../db/anniversaries';
import { getTodaysMatchup, type TodaysMatchup } from '../matchup';
import { getRecentlyViewed } from '../db/viewHistory';
import { BROWSE_PODS } from '../../components/home/CategoryPodGrid';
import { useAuth } from '../../hooks/useAuth';
import { exploreKeys } from './keys';
import type { FavouriteHero } from '../../types';

// Fetch a generous spotlight pool; each view slices to its own size (native 5,
// web sizes responsively). Keeping the larger pool here preserves web's
// rotation/variety without re-fetching.
const SPOTLIGHT_POOL = 10;

export interface ExploreData {
  /** True once the spotlight billboard has settled (success or terminal error) —
   *  both views gate their skeleton on this. */
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

// Stable empty-array identity for the field fallbacks below, so the memoised
// snapshot doesn't churn downstream `useMemo`/effect deps while a row is loading.
const EMPTY: never[] = [];

// Several DB helpers swallow their error and return [] — which makes a *failed*
// fetch indistinguishable from a *legitimately empty* one. Left as-is, React
// Query would store that [] as a successful result, cache it for the full
// staleTime, and stop revalidating — exactly the class of bug where the home
// carousel "sometimes disappears" on back-navigation. Re-throwing on empty tells
// RQ the fetch failed, so it keeps the last-good data and retries. Only wrap
// sources that are *structurally* always populated — never legitimately-optional
// rows (campaigns, debuts, matchup, personalised).
function nonEmpty<T>(rows: T[]): T[] {
  if (rows.length === 0) throw new Error('empty result — treated as a fetch failure');
  return rows;
}

/**
 * Lead the billboard with up to 2 characters on screen right now, then fill with
 * the curated spotlight pool (deduped). If the curated pool comes back empty the
 * whole fan-out is treated as a failure (throw) so React Query keeps the last-good
 * billboard and retries — rather than caching a blank carousel, or pinning a
 * degraded trending-only (~2 card) billboard as "fresh" for the staleTime.
 */
async function fetchSpotlight(): Promise<Hero[]> {
  // allSettled (not Promise.all): a flaky trending RPC must not drop the whole
  // billboard — a curated-only result is still a complete billboard.
  const [trendRes, baseRes] = await Promise.allSettled([
    getTrendingSpotlightHeroes(2),
    getSpotlightHeroes(SPOTLIGHT_POOL),
  ]);
  const trend = trendRes.status === 'fulfilled' ? trendRes.value : [];
  const base = baseRes.status === 'fulfilled' ? baseRes.value : [];
  if (base.length === 0) throw new Error('spotlight: curated pool unavailable');

  const seen = new Set<string>();
  const merged: Hero[] = [];
  for (const h of [...trend, ...base]) {
    if (!seen.has(h.id)) {
      seen.add(h.id);
      merged.push(h);
    }
  }
  return merged;
}

/**
 * Platform-neutral data layer for the Explore/Home screen. Owns every catalogue,
 * editorial, trending, and personalised fetch and returns one flat snapshot.
 * Both `app/(tabs)/explore.tsx` (native, virtualised FlatList) and
 * `explore.web.tsx` (web grid) consume it; each keeps its own presentation.
 *
 * Backed by React Query (the app's standard data layer): every source is an
 * independent cached query sharing the client's 5-min staleTime / 30-min gcTime,
 * so a remount paints instantly from cache and revalidates in the background —
 * and, crucially, a failed refetch never clobbers the last-good row.
 */
export function useExploreData(): ExploreData {
  const { user } = useAuth();
  const userId = user?.id;

  const spotlight = useQuery({ queryKey: exploreKeys.spotlight, queryFn: fetchSpotlight });
  const iconic = useQuery({ queryKey: exploreKeys.iconic, queryFn: () => getIconicHeroes(25) });
  const newlyAdded = useQuery({
    queryKey: exploreKeys.newlyAdded,
    queryFn: () => getNewlyAddedCV(25),
  });
  const rivalries = useQuery({
    queryKey: exploreKeys.rivalries,
    queryFn: () => getTopRivalries(12).then(nonEmpty),
  });
  const browseCovers = useQuery({
    queryKey: exploreKeys.browseCovers,
    queryFn: () => getBrowseCovers(BROWSE_PODS.map((p) => p.slug as CategorySlug)),
  });
  const trendingOnScreen = useQuery({
    queryKey: exploreKeys.trendingOnScreen,
    queryFn: () => getTrendingOnScreen(12).then(nonEmpty),
  });
  const wikiTrending = useQuery({
    queryKey: exploreKeys.wikiTrending,
    queryFn: () => getTrendingHeroesWiki(14).then(nonEmpty),
  });
  const debuts = useQuery({
    queryKey: exploreKeys.debuts,
    queryFn: () => getDebutsThisMonth(14),
  });
  const titleBuckets = useQuery({
    queryKey: exploreKeys.titleBuckets,
    queryFn: () => getTrendingTitlesMulti(['on_screen', 'coming_soon', 'streaming'], 6),
  });
  const campaigns = useQuery({
    queryKey: exploreKeys.campaigns,
    queryFn: () => getActiveCampaigns(),
  });
  const newComics = useQuery({ queryKey: exploreKeys.newComics, queryFn: () => getNewComics(12) });
  const matchup = useQuery({ queryKey: exploreKeys.matchup, queryFn: () => getTodaysMatchup() });
  const heroCount = useQuery({ queryKey: exploreKeys.heroCount, queryFn: () => getHeroCount() });

  // Personalised rows — keyed by userId so they refetch on account change and
  // never leak across accounts; disabled (→ empty) when logged out.
  const recentlyViewed = useQuery({
    queryKey: exploreKeys.recentlyViewed(userId ?? ''),
    queryFn: () => getRecentlyViewed(userId!),
    enabled: !!userId,
  });
  const favourites = useQuery({
    queryKey: exploreKeys.favourites(userId ?? ''),
    queryFn: () => getUserFavouriteHeroes(userId!),
    enabled: !!userId,
  });
  const trendingForUser = useQuery({
    queryKey: exploreKeys.trendingForUser(userId ?? ''),
    queryFn: () => getTrendingForUser(userId!),
    enabled: !!userId,
  });

  // `started` flips once the billboard settles — either it has data (fresh or
  // cached) or its retries were exhausted. Either way the skeleton clears and the
  // rest of the page renders; a failed billboard just leaves the spotlight empty.
  const started = spotlight.data !== undefined || spotlight.isError;

  return useMemo<ExploreData>(
    () => ({
      started,
      spotlight: spotlight.data ?? EMPTY,
      iconic: iconic.data ?? EMPTY,
      newlyAdded: newlyAdded.data ?? EMPTY,
      rivalries: rivalries.data ?? EMPTY,
      browseCovers: browseCovers.data ?? {},
      trendingOnScreen: trendingOnScreen.data ?? EMPTY,
      wikiTrending: wikiTrending.data ?? EMPTY,
      debutsThisMonth: debuts.data ?? EMPTY,
      onScreen: titleBuckets.data?.on_screen ?? EMPTY,
      comingSoon: titleBuckets.data?.coming_soon ?? EMPTY,
      streaming: titleBuckets.data?.streaming ?? EMPTY,
      campaigns: campaigns.data ?? EMPTY,
      newComics: newComics.data ?? EMPTY,
      matchup: matchup.isPending ? undefined : (matchup.data ?? null),
      heroCount: heroCount.data ?? null,
      trendingForUser: userId ? (trendingForUser.data ?? EMPTY) : EMPTY,
      recentlyViewed: userId ? (recentlyViewed.data ?? EMPTY) : EMPTY,
      favourites: userId ? (favourites.data ?? EMPTY) : EMPTY,
    }),
    [
      started,
      spotlight.data,
      iconic.data,
      newlyAdded.data,
      rivalries.data,
      browseCovers.data,
      trendingOnScreen.data,
      wikiTrending.data,
      debuts.data,
      titleBuckets.data,
      campaigns.data,
      newComics.data,
      matchup.isPending,
      matchup.data,
      heroCount.data,
      userId,
      trendingForUser.data,
      recentlyViewed.data,
      favourites.data,
    ],
  );
}
