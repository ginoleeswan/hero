import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  getCategoryPage,
  getHeroById,
  type CategorySlug,
  type CategoryPublisher,
} from '../db/heroes';
import { DEFAULT_FILTERS, type CategoryFilters } from '../db/categoryFilters';
import { generateVerdict, type VerdictInput } from '../api';
import { getCachedVerdict, saveVerdict } from '../db/verdicts';
import { queryKeys } from './keys';
import { findCachedHero } from './heroCache';

export const CATEGORY_PAGE_SIZE = 30;

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
export function useVerdict(
  heroId: string,
  opponentId: string,
  input: VerdictInput | null,
) {
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
