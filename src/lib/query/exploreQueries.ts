import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  assembleSpotlight,
  type Hero,
  type BrowseCover,
  type CategorySlug,
  type Rivalry,
} from '../db/heroes';
import { fetchExploreBundle, type ExploreBundle } from '../db/exploreBundle';
import { getUserFavouriteHeroes } from '../db/favourites';
import { getForYou } from '../db/forYou';
import {
  getTrendingForUser,
  synthesizeCampaignFromPool,
  type TrendingTitle,
  type WikiTrendingHero,
  type Campaign,
  type TrendingTitleCharacter,
} from '../db/trending';
import { type NewComic } from '../db/comics';
import { type DebutIssue } from '../db/anniversaries';
import { getTodaysMatchupFromPool, type TodaysMatchup } from '../matchup';
import { getRecentlyViewed } from '../db/viewHistory';
import { BROWSE_PODS } from '../../components/home/CategoryPodGrid';
import { useAuth } from '../../hooks/useAuth';
import { exploreKeys } from './keys';
import type { FavouriteHero } from '../../types';

// Sample a generous spotlight from the bundled pools; each view slices to its
// own size (native 5, web sizes responsively). Keeping the larger sample here
// preserves web's rotation/variety without re-fetching.
const SPOTLIGHT_POOL = 10;

const BROWSE_SLUGS = BROWSE_PODS.map((p) => p.slug as CategorySlug);

export interface ExploreData {
  /** True once the bundle has settled (success or terminal error) — both views
   *  gate their skeleton on this. */
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
  /** Discovery: characters you HAVEN'T engaged with, from taste + graph. */
  forYou: FavouriteHero[];
}

// Stable empty-array identity for the field fallbacks below, so the memoised
// snapshot doesn't churn downstream `useMemo`/effect deps while loading.
const EMPTY: never[] = [];

/**
 * Platform-neutral data layer for the Explore/Home screen. Owns every catalogue,
 * editorial, trending, and personalised fetch and returns one flat snapshot.
 * Both `app/(tabs)/explore.tsx` (native, virtualised FlatList) and
 * `explore.web.tsx` (web grid) consume it; each keeps its own presentation.
 *
 * Every anonymous section arrives in ONE get_explore_bundle RPC round trip
 * (React Query cached, 5-min staleTime / 30-min gcTime — a remount paints
 * instantly from cache and revalidates in the background). This replaced a
 * ~15-request fan-out that intermittently exhausted the DB connection pool: the
 * synchronized burst of 500s hit whichever queries lost the race, and any
 * fetcher that swallowed its error cached partial rows as "success" for the
 * whole staleTime. One request can't race itself; a failure now fails the whole
 * bundle, so RQ keeps the last-good snapshot and retries with backoff.
 *
 * Only three fetches remain outside the bundle: the daily-matchup verdict
 * (derived client-side from the bundled iconic pool + one cached-verdict read)
 * and the personalised rows (keyed by userId; disabled when logged out).
 */
export function useExploreData(): ExploreData {
  const { user } = useAuth();
  const userId = user?.id;

  const bundle = useQuery({
    queryKey: exploreKeys.bundle,
    queryFn: () => fetchExploreBundle(BROWSE_SLUGS),
  });
  const b: ExploreBundle | undefined = bundle.data;

  // Billboard: sample once per bundle payload (not per render), so the lineup
  // rotates on refetch but stays stable while the snapshot lives.
  const spotlight = useMemo(
    () =>
      b
        ? assembleSpotlight(
            b.trendingSpotlight,
            b.spotlightFamous,
            b.spotlightDiscovery,
            SPOTLIGHT_POOL,
          )
        : EMPTY,
    [b],
  );

  // "Right Now" band: manual editorial campaigns win; otherwise synthesize one
  // from the already-bundled trending buckets (on-screen leads, streaming
  // fallback) — no extra round trips.
  const campaigns = useMemo(() => {
    if (!b) return EMPTY;
    if (b.campaigns.length > 0) return b.campaigns;
    const auto = synthesizeCampaignFromPool([b.titleBuckets.on_screen, b.titleBuckets.streaming]);
    return auto ? [auto] : EMPTY;
  }, [b]);

  // Daily matchup: the pair comes from the bundled iconic pool (first 24, same
  // as getTodaysMatchup's own pool); only the per-pair cached verdict costs a
  // round trip.
  const iconic = b?.iconic ?? EMPTY;
  const matchup = useQuery({
    queryKey: exploreKeys.matchup,
    queryFn: () => getTodaysMatchupFromPool(iconic.slice(0, 24)),
    enabled: iconic.length >= 2,
  });

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
  const forYou = useQuery({
    queryKey: exploreKeys.forYou(userId ?? ''),
    queryFn: () => getForYou(),
    enabled: !!userId,
  });

  // `started` flips once the bundle settles — either it has data (fresh or
  // cached) or its retries were exhausted. Either way the skeleton clears; a
  // failed bundle just leaves the sections empty.
  const started = b !== undefined || bundle.isError;

  return useMemo<ExploreData>(
    () => ({
      started,
      spotlight,
      iconic,
      newlyAdded: b?.newlyAdded ?? EMPTY,
      rivalries: b?.rivalries ?? EMPTY,
      browseCovers: b?.browseCovers ?? {},
      trendingOnScreen: b?.trendingOnScreen ?? EMPTY,
      wikiTrending: b?.wikiTrending ?? EMPTY,
      debutsThisMonth: b?.debutsThisMonth ?? EMPTY,
      onScreen: b?.titleBuckets.on_screen ?? EMPTY,
      comingSoon: b?.titleBuckets.coming_soon ?? EMPTY,
      streaming: b?.titleBuckets.streaming ?? EMPTY,
      campaigns,
      newComics: b?.newComics ?? EMPTY,
      matchup: matchup.isPending ? undefined : (matchup.data ?? null),
      heroCount: b?.heroCount ?? null,
      trendingForUser: userId ? (trendingForUser.data ?? EMPTY) : EMPTY,
      recentlyViewed: userId ? (recentlyViewed.data ?? EMPTY) : EMPTY,
      favourites: userId ? (favourites.data ?? EMPTY) : EMPTY,
      forYou: userId ? (forYou.data ?? EMPTY) : EMPTY,
    }),
    [
      started,
      spotlight,
      iconic,
      b,
      campaigns,
      matchup.isPending,
      matchup.data,
      userId,
      trendingForUser.data,
      recentlyViewed.data,
      favourites.data,
      forYou.data,
    ],
  );
}
