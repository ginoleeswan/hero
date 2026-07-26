// src/hooks/useHouseList.ts
// The house list, cached. Eight rows that change only between deploys, so both
// the index page and the universe-page row share one query and one cache entry.
import { useQuery } from '@tanstack/react-query';
import { listHouses, listHousesForUniverse, type HouseSearchResult } from '../lib/db/houses';

const HOUR = 60 * 60 * 1000;

export function useHouseList(): { houses: HouseSearchResult[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['houses', 'all'],
    staleTime: HOUR,
    queryFn: listHouses,
  });
  return { houses: data ?? [], isLoading };
}

/**
 * Houses belonging to one universe. Returns empty for the ~200 universes that
 * have none, which is the common case — the caller renders nothing.
 */
export function useUniverseHouses(universe: string | null | undefined): HouseSearchResult[] {
  const { data } = useQuery({
    queryKey: ['houses', 'universe', universe],
    enabled: !!universe,
    staleTime: HOUR,
    queryFn: () => listHousesForUniverse(universe!),
  });
  return data ?? [];
}
