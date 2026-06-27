import { useMemo } from 'react';
import { searchUniverses, type UniverseResult } from '../lib/db/universes';
import { useHeroSearch } from './useHeroSearch';
import type { HeroSearchResult } from '../lib/db/heroes';

export interface UnifiedSearch {
  universes: UniverseResult[];
  heroes: HeroSearchResult[];
  loading: boolean;
  resultCount: number;
}

// Grouped search across types. Universes resolve synchronously from the registry
// (instant), heroes ride the existing debounced RPC. Section order is fixed by
// the consumer: universes first, then heroes.
export function useUnifiedSearch(query: string, heroLimit = 100): UnifiedSearch {
  const trimmed = query.trim();
  const universes = useMemo(() => searchUniverses(trimmed, 3), [trimmed]);
  const { results: heroes, loading } = useHeroSearch(query, 'All', heroLimit);
  return { universes, heroes, loading, resultCount: heroes.length };
}
