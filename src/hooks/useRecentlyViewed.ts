import { useQuery } from '@tanstack/react-query';
import { getRecentlyViewed } from '../lib/db/viewHistory';
import { viewHistoryKeys } from '../lib/query/keys';
import type { FavouriteHero } from '../types';

/**
 * One limit for every surface, so the home rail, the /search landing and the
 * desktop search palette share a single cache entry instead of each holding its
 * own (a differing limit would fork the key and refetch).
 */
export const RECENTLY_VIEWED_LIMIT = 16;

const EMPTY: FavouriteHero[] = [];

/**
 * The signed-in user's recently-viewed characters, React Query cached under one
 * shared key. Every consumer paints from cache on mount — the palette used to
 * refetch (two sequential round trips) on each open, which is why the rail
 * popped in late. Returns EMPTY (stable) when logged out or still loading.
 */
export function useRecentlyViewed(userId: string | undefined): FavouriteHero[] {
  const { data } = useQuery({
    queryKey: viewHistoryKeys.recent(userId ?? ''),
    queryFn: () => getRecentlyViewed(userId!, RECENTLY_VIEWED_LIMIT),
    enabled: !!userId,
  });
  return userId ? (data ?? EMPTY) : EMPTY;
}
