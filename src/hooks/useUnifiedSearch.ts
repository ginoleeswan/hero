import { useEffect, useMemo, useState } from 'react';
import { searchUniverses, type UniverseResult } from '../lib/db/universes';
import { searchTitles, type TitleSearchResult } from '../lib/db/titles';
import { useHeroSearch } from './useHeroSearch';
import type { HeroSearchResult } from '../lib/db/heroes';

export interface UnifiedSearch {
  universes: UniverseResult[];
  heroes: HeroSearchResult[];
  titles: TitleSearchResult[];
  loading: boolean;
  resultCount: number;
}

// Grouped search across types. Universes resolve synchronously from the registry
// (instant); heroes ride the existing debounced RPC; titles are a debounced
// ILIKE query. Section order is fixed by the consumer: universes, heroes, titles.
export function useUnifiedSearch(query: string, heroLimit = 100): UnifiedSearch {
  const trimmed = query.trim();
  const universes = useMemo(() => searchUniverses(trimmed, 3), [trimmed]);
  const { results: heroes, loading } = useHeroSearch(query, 'All', heroLimit);

  const [titles, setTitles] = useState<TitleSearchResult[]>([]);
  useEffect(() => {
    if (!trimmed) {
      setTitles([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchTitles(trimmed, 6);
      if (!cancelled) setTitles(res);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  return { universes, heroes, titles, loading, resultCount: heroes.length };
}
