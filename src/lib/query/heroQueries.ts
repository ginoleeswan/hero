import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  getCategoryPage,
  getUniversePage,
  getFranchisePage,
  getTeamPage,
  getHeroById,
  heroRowToCharacterData,
  getHeroesByNames,
  getRelatedHeroes,
  getRelationship,
  getPowerPercentile,
  searchHeroes,
  searchHeroesPage,
  getFamilyOpponents,
  getHeroesByPowerRange,
  type CategorySlug,
  type CategoryPublisher,
  type PublisherFilter,
  type AlignmentFilter,
} from '../db/heroes';
import { getTeamById } from '../db/teams';
import { DEFAULT_FILTERS, type CategoryFilters } from '../db/categoryFilters';
import { generateVerdict, HeroNotFoundError, type VerdictInput } from '../api';
import { getCachedVerdict } from '../db/verdicts';
import { queryKeys } from './keys';
import { findCachedHero } from './heroCache';

export const CATEGORY_PAGE_SIZE = 30;
export const HERO_SEARCH_PAGE_SIZE = 30;

// For grouped relationship fetches: one flaky kind (a 500 on enemies, say) must
// not drop the whole section — take the rows that resolved, empty for the rest.
const settledRows = <T>(r: PromiseSettledResult<T[]>): T[] =>
  r.status === 'fulfilled' ? r.value : [];

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
    // Filter/search changes keep the previous grid on screen (dimmed) instead
    // of flashing the whole page back to skeletons — same as the search grid.
    placeholderData: keepPreviousData,
  });
}

/** Infinite list for a UNIVERSE browse page — same shape as useCategoryHeroes
 *  but keyed on a publisher ILIKE term (registry query or raw universe name). */
export function useUniverseHeroes(term: string | null, filters: CategoryFilters) {
  return useInfiniteQuery({
    queryKey: term ? ['heroes', 'universe', term, filters] : ['heroes', 'universe', 'disabled'],
    enabled: !!term,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getUniversePage(term!, {
        page: pageParam,
        pageSize: CATEGORY_PAGE_SIZE,
        withCount: pageParam === 0,
        ...filters,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.heroes.length === CATEGORY_PAGE_SIZE ? allPages.length : undefined,
    // Filter/search changes keep the previous grid on screen (dimmed) instead
    // of flashing the whole page back to skeletons — same as the search grid.
    placeholderData: keepPreviousData,
  });
}

/** Infinite list for a FRANCHISE browse page — franchise sibling of
 *  useUniverseHeroes, keyed on an exact `heroes.franchise` value. */
export function useFranchiseHeroes(term: string | null, filters: CategoryFilters) {
  return useInfiniteQuery({
    queryKey: term ? ['heroes', 'franchise', term, filters] : ['heroes', 'franchise', 'disabled'],
    enabled: !!term,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getFranchisePage(term!, {
        page: pageParam,
        pageSize: CATEGORY_PAGE_SIZE,
        withCount: pageParam === 0,
        ...filters,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.heroes.length === CATEGORY_PAGE_SIZE ? allPages.length : undefined,
    // Filter/search changes keep the previous grid on screen (dimmed) instead
    // of flashing the whole page back to skeletons — same as the search grid.
    placeholderData: keepPreviousData,
  });
}

/** Infinite, faceted member list for a TEAM browse page — team sibling of
 *  useUniverseHeroes. `teamName` is the value matched against `heroes.teams[]`. */
export function useTeamHeroes(teamName: string | null, filters: CategoryFilters) {
  return useInfiniteQuery({
    queryKey: teamName ? ['heroes', 'team', teamName, filters] : ['heroes', 'team', 'disabled'],
    enabled: !!teamName,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getTeamPage(teamName!, {
        page: pageParam,
        pageSize: CATEGORY_PAGE_SIZE,
        withCount: pageParam === 0,
        ...filters,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.heroes.length === CATEGORY_PAGE_SIZE ? allPages.length : undefined,
    // Filter/search changes keep the previous grid on screen (dimmed) instead
    // of flashing the whole page back to skeletons — same as the search grid.
    placeholderData: keepPreviousData,
  });
}

/** Team summary (header identity + the membership term that drives useTeamHeroes).
 *  Separate from the member grid so both can cache independently. */
export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.team(id) : ['teams', 'detail', 'disabled'],
    enabled: !!id,
    queryFn: () => getTeamById(id!),
    staleTime: 1000 * 60 * 30,
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

/** Displayable powerstats for a hero by id, straight from the DB row. Used by
 *  the compare matchup (keyed per hero, so each combatant caches independently).
 *  An absent id throws — never fall back to the external SuperheroAPI, which
 *  still resolves merged-away ids and would fabricate phantom stats. */
async function loadHeroStats(id: string) {
  const row = await getHeroById(id);
  if (!row) throw new HeroNotFoundError(id);
  return heroRowToCharacterData(row).stats;
}

export function useHeroStats(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.heroStats(id) : ['heroes', 'stats', 'disabled'],
    enabled: !!id,
    queryFn: () => loadHeroStats(id!),
    staleTime: 1000 * 60 * 30,
  });
}

// ── Opponent picker (compare) ───────────────────────────────────────────────

/** The full roster for the opponent picker — one large fetch, cached so
 *  reopening the picker is instant instead of re-pulling ~600 rows. */
export function useHeroRoster(limit = 600) {
  return useQuery({
    queryKey: queryKeys.heroRoster(limit),
    queryFn: () => searchHeroes('', 'All', limit),
    staleTime: 1000 * 60 * 30,
  });
}

/** Relationship rows for the picker — rivals (enemies), teammates, allies, and
 *  bloodline — resolved in one round-trip, cached per hero. */
export function usePickRelations(hero: string | undefined) {
  return useQuery({
    queryKey: hero ? queryKeys.pickRelations(hero) : ['heroes', 'pickRelations', 'disabled'],
    enabled: !!hero,
    queryFn: async () => {
      const [rivals, teammates, allies, family] = await Promise.allSettled([
        getRelatedHeroes(hero!, 'enemy', { sameUniverse: true, limit: 40 }),
        getRelatedHeroes(hero!, 'teammate', { sameUniverse: true, limit: 24 }),
        getRelatedHeroes(hero!, 'ally', { sameUniverse: true, limit: 24 }),
        getFamilyOpponents(hero!, 24),
      ]);
      return {
        rivals: settledRows(rivals),
        teammates: settledRows(teammates),
        allies: settledRows(allies),
        family: settledRows(family),
      };
    },
    staleTime: 1000 * 60 * 30,
  });
}

/** Heroes within a powerstats-total band — "comparable power" suggestions. */
export function useHeroesByPowerRange(lo: number, hi: number, excludeId: string) {
  return useQuery({
    queryKey: queryKeys.powerRange(lo, hi, excludeId),
    enabled: hi > 0,
    queryFn: () => getHeroesByPowerRange(lo, hi, excludeId),
    staleTime: 1000 * 60 * 30,
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
      const [enemies, allies, teammates] = await Promise.allSettled([
        getRelatedHeroes(heroId!, 'enemy', { sameUniverse: true, limit: 24 }),
        getRelatedHeroes(heroId!, 'ally', { sameUniverse: true, limit: 24 }),
        getRelatedHeroes(heroId!, 'teammate', { sameUniverse: true, limit: 24 }),
      ]);
      return {
        enemies: settledRows(enemies),
        allies: settledRows(allies),
        teammates: settledRows(teammates),
      };
    },
    staleTime: 1000 * 60 * 30,
  });
}

/** The relationship between two heroes (for the matchup badge / verdict context). */
export function useRelationship(a: string | undefined, b: string | undefined) {
  return useQuery({
    queryKey: ['relationship', a ?? '', b ?? ''],
    enabled: !!a && !!b,
    queryFn: () => getRelationship(a!, b!),
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
      // The edge function persists the cache server-side (service_role); pass the
      // ids so it can key the write to this matchup pair.
      return generateVerdict({ ...input!, heroAId: heroId, heroBId: opponentId });
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
