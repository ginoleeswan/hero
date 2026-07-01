import type { CategorySlug, CategoryPublisher } from '../db/heroes';
import type { CategoryFilters } from '../db/categoryFilters';

// Single source of truth for cache keys. All keys live under the 'heroes' root
// so the whole domain can be invalidated at once, and so findCachedHero can scan
// every category list with the ['heroes','category'] prefix.
export const queryKeys = {
  root: ['heroes'] as const,
  categoryPage: (slug: CategorySlug, filters: CategoryFilters) =>
    ['heroes', 'category', slug, filters] as const,
  featured: (slug: CategorySlug, publisher: CategoryPublisher) =>
    ['heroes', 'featured', slug, publisher] as const,
  heroDetail: (id: string) => ['heroes', 'detail', id] as const,
  powerPercentile: (total: number) => ['heroes', 'percentile', total] as const,
  heroesByNames: (names: string) => ['heroes', 'byNames', names] as const,
  search: (query: string, publisher: string, alignment: string) =>
    ['heroes', 'search', query, publisher, alignment] as const,
  verdict: (heroId: string, opponentId: string) =>
    ['heroes', 'verdict', heroId, opponentId] as const,
  // Character detail-screen secondary reads (see heroDetailQueries).
  heroFamily: (id: string) => ['heroes', 'family', id] as const,
  heroNarrative: (id: string) => ['heroes', 'narrative', id] as const,
  heroTitles: (id: string) => ['heroes', 'titles', id] as const,
  heroPortrayals: (id: string) => ['heroes', 'portrayals', id] as const,
  heroLinks: (id: string) => ['heroes', 'links', id] as const,
  heroIssues: (id: string) => ['heroes', 'issues', id] as const,
  heroStats: (id: string) => ['heroes', 'stats', id] as const,
  heroRoster: (limit: number) => ['heroes', 'roster', limit] as const,
  pickRelations: (id: string) => ['heroes', 'pickRelations', id] as const,
  powerRange: (lo: number, hi: number, excludeId: string) =>
    ['heroes', 'powerRange', lo, hi, excludeId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  team: (id: string) => ['teams', 'detail', id] as const,
  issue: (id: string) => ['comics', 'issue', id] as const,
  newComics: (limit: number) => ['comics', 'new', limit] as const,
};

// Explore/Home keys, under an 'explore' root so the whole home surface can be
// invalidated together. Personalised rows are keyed by userId so they refetch
// (and don't leak across accounts) when the signed-in user changes.
export const exploreKeys = {
  root: ['explore'] as const,
  spotlight: ['explore', 'spotlight'] as const,
  iconic: ['explore', 'iconic'] as const,
  newlyAdded: ['explore', 'newlyAdded'] as const,
  rivalries: ['explore', 'rivalries'] as const,
  browseCovers: ['explore', 'browseCovers'] as const,
  trendingOnScreen: ['explore', 'trendingOnScreen'] as const,
  wikiTrending: ['explore', 'wikiTrending'] as const,
  debuts: ['explore', 'debuts'] as const,
  titleBuckets: ['explore', 'titleBuckets'] as const,
  campaigns: ['explore', 'campaigns'] as const,
  newComics: ['explore', 'newComics'] as const,
  matchup: ['explore', 'matchup'] as const,
  heroCount: ['explore', 'heroCount'] as const,
  recentlyViewed: (userId: string) => ['explore', 'recentlyViewed', userId] as const,
  favourites: (userId: string) => ['explore', 'favourites', userId] as const,
  trendingForUser: (userId: string) => ['explore', 'trendingForUser', userId] as const,
};

// Title (film/TV/game) detail-screen keys, under a 'titles' root so the whole
// domain can be invalidated together and findCachedTitle can scan the rec lists.
export const titleKeys = {
  root: ['titles'] as const,
  detail: (id: string) => ['titles', 'detail', id] as const,
  heroes: (id: string) => ['titles', 'heroes', id] as const,
  recs: (id: string) => ['titles', 'recs', id] as const,
  collection: (id: string) => ['titles', 'collection', id] as const,
};
