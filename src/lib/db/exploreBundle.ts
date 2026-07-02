import { supabase } from '../supabase';
import {
  assignBrowseCovers,
  mapRivalryRows,
  type BrowseCover,
  type BrowseCoverCandidate,
  type CategorySlug,
  type Hero,
  type Rivalry,
  type RivalryRow,
} from './heroes';
import {
  groupCampaignRows,
  groupOnScreenRows,
  mapWikiTrendingRows,
  splitTitleBuckets,
  type Campaign,
  type CampaignRow,
  type TrendingBucket,
  type TrendingOnScreenRow,
  type TrendingTitle,
  type TrendingTitleRow,
  type WikiTrendingHero,
  type WikiTrendingRow,
} from './trending';
import { groupComicRows, type NewComic, type NewComicRow } from './comics';
import { mapDebutRows, type DebutIssue, type DebutIssueRow } from './anniversaries';

// The get_explore_bundle RPC's raw jsonb payload. Section shapes are the same
// flat rows the per-section fetchers receive — the mappers below are shared with
// those paths, so the two can't drift.
interface RawExploreBundle {
  spotlight_famous: Hero[];
  spotlight_discovery: Hero[];
  trending_spotlight: Hero[];
  iconic: Hero[];
  newly_added: Hero[];
  rivalries: RivalryRow[];
  browse_covers: BrowseCoverCandidate[];
  trending_on_screen: TrendingOnScreenRow[];
  wiki_trending: WikiTrendingRow[];
  debuts: DebutIssueRow[];
  title_buckets: (TrendingTitleRow & { bucket: TrendingBucket })[];
  campaigns: CampaignRow[];
  new_comics: NewComicRow[];
  hero_count: number;
}

export interface ExploreBundle {
  /** Raw billboard pools — the view samples via assembleSpotlight per mount. */
  spotlightFamous: Hero[];
  spotlightDiscovery: Hero[];
  trendingSpotlight: Hero[];
  iconic: Hero[];
  newlyAdded: Hero[];
  rivalries: Rivalry[];
  browseCovers: Record<string, BrowseCover>;
  trendingOnScreen: TrendingTitle[];
  wikiTrending: WikiTrendingHero[];
  debutsThisMonth: DebutIssue[];
  titleBuckets: Record<TrendingBucket, TrendingTitle[]>;
  /** Manual editorial campaigns only — the caller synthesizes the trending
   *  fallback from titleBuckets when this is empty. */
  campaigns: Campaign[];
  newComics: NewComic[];
  heroCount: number;
}

/**
 * The entire anonymous Explore/Home surface in ONE round trip. Replaces the
 * ~15-request fan-out that intermittently exhausted the DB connection pool
 * (synchronized 500s → partial rows cached as "success"). Personalised rows
 * (favourites, recently viewed, trending-for-user) stay separate, keyed by user.
 */
export async function fetchExploreBundle(slugs: CategorySlug[]): Promise<ExploreBundle> {
  const { data, error } = await supabase.rpc('get_explore_bundle', { p_browse_slugs: slugs });
  if (error) throw error;
  const raw = data as unknown as RawExploreBundle;

  // These pools are structurally always populated (the catalogue has thousands
  // of qualifying heroes) — empty means the read failed, so throw and let React
  // Query keep the last-good bundle and retry.
  if ((raw.spotlight_famous?.length ?? 0) === 0 || (raw.iconic?.length ?? 0) === 0) {
    throw new Error('explore bundle: core catalogue sections empty — treated as a fetch failure');
  }

  return {
    spotlightFamous: raw.spotlight_famous,
    spotlightDiscovery: raw.spotlight_discovery ?? [],
    trendingSpotlight: raw.trending_spotlight ?? [],
    iconic: raw.iconic,
    newlyAdded: raw.newly_added ?? [],
    rivalries: mapRivalryRows(raw.rivalries ?? []),
    browseCovers: assignBrowseCovers(raw.browse_covers ?? [], slugs),
    trendingOnScreen: groupOnScreenRows(raw.trending_on_screen ?? []),
    wikiTrending: mapWikiTrendingRows(raw.wiki_trending ?? []),
    debutsThisMonth: mapDebutRows(raw.debuts ?? []),
    titleBuckets: splitTitleBuckets(raw.title_buckets ?? []),
    campaigns: groupCampaignRows(raw.campaigns ?? []),
    newComics: groupComicRows(raw.new_comics ?? []),
    heroCount: raw.hero_count ?? 0,
  };
}
