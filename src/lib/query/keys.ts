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
  search: (query: string, publisher: string, alignment: string) =>
    ['heroes', 'search', query, publisher, alignment] as const,
  verdict: (heroId: string, opponentId: string) =>
    ['heroes', 'verdict', heroId, opponentId] as const,
};
