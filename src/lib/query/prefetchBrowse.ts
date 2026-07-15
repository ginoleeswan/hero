// Prefetch a browse page's first grid page the moment the user TOUCHES its
// entry card (onPressIn fires ~100-300ms before navigation commits, and the
// route itself then takes ~50ms to mount) — by the time the grid mounts, the
// query is already in the cache and the page paints instantly.
//
// The query keys and filter objects must match the page's own hooks EXACTLY
// (React Query hashes keys by value): useUniverseHeroes / useCategoryHeroes in
// heroQueries.ts and the paramsToFilters(slug, {}) default the page seeds with.
import { queryClient } from './queryClient';
import { heroGridImageSource } from '../../constants/heroImages';
import { queryKeys } from './keys';
import { getCategoryPage, getUniversePage } from '../db/heroes/categories';
import type { CategorySlug } from '../db/heroes/types';
import { paramsToFilters } from '../db/categoryFilters';
import { publisherBySlug } from '../../constants/publishers';
import { CATEGORY_PAGE_SIZE } from './heroQueries';

const STALE = 1000 * 60 * 5;

// After the data lands, start the first two rows' images downloading too — the
// browser has them cached (or in flight) before the grid even mounts.
function warmGridImages(page: unknown): void {
  if (typeof window === 'undefined') return;
  const heroes = (page as { heroes?: Array<Record<string, unknown>> })?.heroes ?? [];
  for (const h of heroes.slice(0, 6)) {
    const { uri } = heroGridImageSource(
      String(h.id),
      h.image_url as string | null,
      h.portrait_url as string | null,
      h.image_md_url as string | null,
      360,
    );
    if (uri) new window.Image().src = uri;
  }
}

/** Warm /universe/[slug]'s first page. Safe to call repeatedly (deduped). */
export function prefetchUniverse(slug: string): void {
  const term = publisherBySlug(slug)?.query ?? decodeURIComponent(slug);
  const filters = paramsToFilters(null, {});
  void queryClient
    .prefetchInfiniteQuery({
      queryKey: ['heroes', 'universe', term, filters],
      initialPageParam: 0,
      staleTime: STALE,
      queryFn: ({ pageParam }) =>
        getUniversePage(term, {
          page: pageParam as number,
          pageSize: CATEGORY_PAGE_SIZE,
          withCount: pageParam === 0,
          ...filters,
        }).then((page) => {
          warmGridImages(page);
          return page;
        }),
    })
    .catch(() => {});
}

/** Warm /category/[slug]'s first page. */
export function prefetchCategory(slug: CategorySlug): void {
  const filters = paramsToFilters(slug, {});
  void queryClient
    .prefetchInfiniteQuery({
      queryKey: queryKeys.categoryPage(slug, filters),
      initialPageParam: 0,
      staleTime: STALE,
      queryFn: ({ pageParam }) =>
        getCategoryPage(slug, {
          page: pageParam as number,
          pageSize: CATEGORY_PAGE_SIZE,
          withCount: pageParam === 0,
          ...filters,
        }).then((page) => {
          warmGridImages(page);
          return page;
        }),
    })
    .catch(() => {});
}

/** Lever 3: after the home surface settles, quietly warm the most likely
 *  destinations (the flagship universes) during browser idle time — a user
 *  tapping Marvel or DC then gets a fully cached page: zero query, images
 *  already in the HTTP cache. ~2 small requests, deduped by React Query. */
export function idlePrefetchTopUniverses(): void {
  if (typeof window === 'undefined') return;
  const kick = () => {
    prefetchUniverse('marvel');
    prefetchUniverse('dc');
  };
  if ('requestIdleCallback' in window) {
    (window as { requestIdleCallback: (cb: () => void, o?: object) => void }).requestIdleCallback(
      kick,
      { timeout: 4000 },
    );
  } else {
    setTimeout(kick, 2500);
  }
}
