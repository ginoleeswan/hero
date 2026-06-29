// src/lib/query/titleQueries.ts
// React Query layer for the title (film/TV/game) detail screen — the sibling of
// heroQueries. Screens read these hooks instead of calling db/titles directly,
// so revisits are served from cache (5-min staleTime + the anti-flash gate skip
// the skeleton entirely), in-flight requests dedup, and data refreshes in the
// background. Recommendations / collection change rarely, so they hold longer.
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getTitleById,
  getTitleHeroes,
  getRecommendedTitles,
  getCollectionTitles,
  type HeroTitle,
} from '../db/titles';
import { titleKeys } from './keys';
import { findCachedTitle } from './titleCache';

const RECS_STALE = 1000 * 60 * 30;

/** The title row for the detail screen. null = not found. placeholderData is a
 *  stub built from a cached recommendation row, so navigating to a title from a
 *  rail paints the header instantly (isPlaceholderData flags it as the stub). */
export function useTitle(id: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: id ? titleKeys.detail(id) : titleKeys.detail('disabled'),
    enabled: !!id,
    queryFn: () => getTitleById(id!),
    placeholderData: () => (id ? findCachedTitle(client, id) : undefined),
  });
}

/** Heroes linked to this title (loads in parallel with the title row). */
export function useTitleHeroes(id: string | undefined) {
  return useQuery({
    queryKey: id ? titleKeys.heroes(id) : titleKeys.heroes('disabled'),
    enabled: !!id,
    queryFn: () => getTitleHeroes(id!),
  });
}

/** "You might also like" — derived from the loaded title, so it waits on it. */
export function useRecommendedTitles(film: HeroTitle | null | undefined) {
  return useQuery({
    queryKey: film ? titleKeys.recs(film.id) : titleKeys.recs('disabled'),
    enabled: !!film,
    queryFn: () => getRecommendedTitles(film!),
    staleTime: RECS_STALE,
  });
}

/** "More in this Universe" — the title's collection, also derived from it. */
export function useCollectionTitles(film: HeroTitle | null | undefined) {
  return useQuery({
    queryKey: film ? titleKeys.collection(film.id) : titleKeys.collection('disabled'),
    enabled: !!film,
    queryFn: () => getCollectionTitles(film!),
    staleTime: RECS_STALE,
  });
}

/** Warm the title row before navigating (e.g. on card hover/press). */
export function prefetchTitle(client: QueryClient, id: string) {
  return client.prefetchQuery({
    queryKey: titleKeys.detail(id),
    queryFn: () => getTitleById(id),
  });
}
