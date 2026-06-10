import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  getCategoryPage,
  getHeroById,
  getHeroesByNames,
  getRelatedHeroes,
  getPowerPercentile,
  searchHeroesPage,
  type CategorySlug,
  type CategoryPublisher,
  type PublisherFilter,
  type AlignmentFilter,
} from '../db/heroes';
import { DEFAULT_FILTERS, type CategoryFilters } from '../db/categoryFilters';
import { generateVerdict, type VerdictInput } from '../api';
import { getCachedVerdict, saveVerdict } from '../db/verdicts';
import { queryKeys } from './keys';
import { findCachedHero } from './heroCache';

export const CATEGORY_PAGE_SIZE = 30;
export const HERO_SEARCH_PAGE_SIZE = 30;

/** Infinite search/browse for the Search tab. Empty query → top heroes for the
 *  publisher; a real query → alias/typo-tolerant ranked search. Publisher and
 *  alignment are server-side so pages stay correctly filled. keepPreviousData
 *  keeps the current grid up while a new filter loads (instant-feeling switches);
 *  the shared 5-min staleTime serves revisits from cache. */
export function useHeroSearchInfinite(
  query: string,
  publisher: PublisherFilter,
  alignment: AlignmentFilter,
) {
  const q = query.trim();
  return useInfiniteQuery({
    queryKey: queryKeys.search(q, publisher, alignment),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchHeroesPage(q, publisher, alignment, pageParam, HERO_SEARCH_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === HERO_SEARCH_PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });
}

/** Warm a publisher's first browse page on mount so the first switch is cached. */
export function prefetchHeroSearch(client: QueryClient, publisher: PublisherFilter) {
  return client.prefetchInfiniteQuery({
    queryKey: queryKeys.search('', publisher, 'All'),
    queryFn: () => searchHeroesPage('', publisher, 'All', 0, HERO_SEARCH_PAGE_SIZE),
    initialPageParam: 0,
  });
}

/** Infinite list for the category grid. Counts only on page 0 (via withCount). */
export function useCategoryHeroes(slug: CategorySlug | null, filters: CategoryFilters) {
  return useInfiniteQuery({
    queryKey: slug ? queryKeys.categoryPage(slug, filters) : ['heroes', 'category', 'disabled'],
    enabled: !!slug,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getCategoryPage(slug!, {
        page: pageParam,
        pageSize: CATEGORY_PAGE_SIZE,
        withCount: pageParam === 0,
        ...filters,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.heroes.length === CATEGORY_PAGE_SIZE ? allPages.length : undefined,
  });
}

/** Single most-popular hero for the featured banner (respects publisher facet). */
export function useFeaturedHero(slug: CategorySlug | null, publisher: CategoryPublisher) {
  return useQuery({
    queryKey: slug ? queryKeys.featured(slug, publisher) : ['heroes', 'featured', 'disabled'],
    enabled: !!slug,
    queryFn: async () => {
      const res = await getCategoryPage(slug!, {
        ...DEFAULT_FILTERS,
        page: 0,
        pageSize: 1,
        withCount: false,
        sort: 'popular',
        publisher,
      });
      return res.heroes[0] ?? null;
    },
  });
}

/** The hero row for the detail screen. Placeholder = the row already cached in
 *  a category list, so name + portrait paint instantly on navigation. */
export function useHeroRow(id: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: id ? queryKeys.heroDetail(id) : ['heroes', 'detail', 'disabled'],
    enabled: !!id,
    queryFn: () => getHeroById(id!),
    placeholderData: () => (id ? findCachedHero(client, id) : undefined),
  });
}

/** Percentile rank of a hero's total powerstats vs all ranked heroes.
 *  Drives the "Stronger than N% of heroes" hook. Rankings shift slowly, so a
 *  long staleTime keeps this off the network for revisits within a session. */
export function useHeroPercentile(total: number | null) {
  return useQuery({
    queryKey: total ? queryKeys.powerPercentile(total) : ['heroes', 'percentile', 'disabled'],
    enabled: !!total && total > 0,
    queryFn: () => getPowerPercentile(total!),
    staleTime: 1000 * 60 * 60,
  });
}

/** Resolve enemy/ally names to hero rows for navigable cards. Keyed by the
 *  sorted name set so the same cast resolves from cache across heroes that
 *  share rivals. Names shift rarely → long staleTime. */
export function useHeroesByNames(names: string[]) {
  const sorted = [...names]
    .map((n) => n.trim())
    .filter(Boolean)
    .sort();
  return useQuery({
    queryKey: queryKeys.heroesByNames(sorted.join('|')),
    enabled: sorted.length > 0,
    queryFn: () => getHeroesByNames(sorted),
    staleTime: 1000 * 60 * 30,
  });
}

/** Resolved enemies / allies / teammates straight from the relationship graph
 *  (same-universe, popularity-ranked). One round-trip per grouping, cached. */
export function useRelatedHeroes(heroId: string | undefined) {
  return useQuery({
    queryKey: ['relatedHeroes', heroId ?? ''],
    enabled: !!heroId,
    queryFn: async () => {
      const [enemies, allies, teammates] = await Promise.all([
        getRelatedHeroes(heroId!, 'enemy', { sameUniverse: true, limit: 24 }),
        getRelatedHeroes(heroId!, 'ally', { sameUniverse: true, limit: 24 }),
        getRelatedHeroes(heroId!, 'teammate', { sameUniverse: true, limit: 24 }),
      ]);
      return { enemies, allies, teammates };
    },
    staleTime: 1000 * 60 * 30,
  });
}

/** Warm the detail row before navigating (call on card press). */
export function prefetchHeroRow(client: QueryClient, id: string) {
  return client.prefetchQuery({
    queryKey: queryKeys.heroDetail(id),
    queryFn: () => getHeroById(id),
  });
}

/** AI battle verdict for a matchup. DB-persisted so the edge function is called
 *  at most once per matchup pair across all users and refreshes. React Query
 *  provides the in-session layer; Supabase provides cross-session persistence. */
export function useVerdict(heroId: string, opponentId: string, input: VerdictInput | null) {
  return useQuery({
    queryKey: queryKeys.verdict(heroId, opponentId),
    enabled: !!input,
    queryFn: async () => {
      const cached = await getCachedVerdict(heroId, opponentId);
      if (cached) return cached;
      const verdict = await generateVerdict(input!);
      await saveVerdict(heroId, opponentId, verdict);
      return verdict;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
