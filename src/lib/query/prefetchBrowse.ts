// Prefetch a browse page's first grid page the moment the user TOUCHES its
// entry card (onPressIn fires ~100-300ms before navigation commits, and the
// route itself then takes ~50ms to mount) — by the time the grid mounts, the
// query is already in the cache and the page paints instantly.
//
// The query keys and filter objects must match the page's own hooks EXACTLY
// (React Query hashes keys by value): useUniverseHeroes / useCategoryHeroes in
// heroQueries.ts and the paramsToFilters(slug, {}) default the page seeds with.
import { queryClient } from './queryClient';
import { queryKeys } from './keys';
import { getCategoryPage, getUniversePage } from '../db/heroes/categories';
import type { CategorySlug } from '../db/heroes/types';
import { paramsToFilters } from '../db/categoryFilters';
import { publisherBySlug } from '../../constants/publishers';
import { CATEGORY_PAGE_SIZE } from './heroQueries';

const STALE = 1000 * 60 * 5;

/** Warm /universe/[slug]'s first page. Safe to call repeatedly (deduped). */
export function prefetchUniverse(slug: string): void {
  const term = publisherBySlug(slug)?.query ?? decodeURIComponent(slug);
  const filters = paramsToFilters(null, {});
  void queryClient.prefetchInfiniteQuery({
    queryKey: ['heroes', 'universe', term, filters],
    initialPageParam: 0,
    staleTime: STALE,
    queryFn: ({ pageParam }) =>
      getUniversePage(term, {
        page: pageParam as number,
        pageSize: CATEGORY_PAGE_SIZE,
        withCount: pageParam === 0,
        ...filters,
      }),
  });
}

/** Warm /category/[slug]'s first page. */
export function prefetchCategory(slug: CategorySlug): void {
  const filters = paramsToFilters(slug, {});
  void queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.categoryPage(slug, filters),
    initialPageParam: 0,
    staleTime: STALE,
    queryFn: ({ pageParam }) =>
      getCategoryPage(slug, {
        page: pageParam as number,
        pageSize: CATEGORY_PAGE_SIZE,
        withCount: pageParam === 0,
        ...filters,
      }),
  });
}
