import { useEffect, useMemo, useState } from 'react';
import { searchUniverses, type UniverseResult } from '../lib/db/universes';
import { searchTeams, type TeamSearchResult } from '../lib/db/teams';
import { searchTitles, type TitleSearchResult } from '../lib/db/titles';
import { searchHouses, type HouseSearchResult } from '../lib/db/houses';
import { useHeroSearch } from './useHeroSearch';
import { track } from '../lib/analytics';
import type { HeroSearchResult } from '../lib/db/heroes';

export interface UnifiedSearch {
  universes: UniverseResult[];
  teams: TeamSearchResult[];
  heroes: HeroSearchResult[];
  titles: TitleSearchResult[];
  houses: HouseSearchResult[];
  loading: boolean;
  resultCount: number;
}

// Shared debounced async-query primitive for the secondary result sections
// (teams, titles). Empty query → []. `fetcher` is a stable module function, so
// it's safe in the dep array.
function useDebouncedQuery<T>(
  trimmed: string,
  fetcher: (q: string, limit: number) => Promise<T[]>,
  limit: number,
): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    if (!trimmed) {
      // Clear results for an empty query. Effect-based fetch (pre-React-Query);
      // the reset guards a stale flash before the next debounced fetch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await fetcher(trimmed, limit);
      if (!cancelled) setItems(res);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, fetcher, limit]);
  return items;
}

// Grouped search across types. Universes resolve synchronously from the registry;
// heroes ride the existing debounced RPC; teams + titles are debounced queries.
// Section order (consumer): universes, houses, teams, heroes, titles. Houses sit
// high because someone typing "targaryen" almost certainly wants the dynasty,
// not the fifty-five characters who share the surname.
export function useUnifiedSearch(query: string, heroLimit = 100): UnifiedSearch {
  const trimmed = query.trim();
  const universes = useMemo(() => searchUniverses(trimmed, 3), [trimmed]);
  const { results: heroes, loading } = useHeroSearch(query, 'All', heroLimit);
  const teams = useDebouncedQuery(trimmed, searchTeams, 6);
  const titles = useDebouncedQuery(trimmed, searchTitles, 6);
  const houses = useDebouncedQuery(trimmed, searchHouses, 4);

  // One analytics event per settled query (not per keystroke): debounce on the
  // trimmed string and ignore 1-char noise. Query length only — never the term.
  useEffect(() => {
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => track('search', { length: trimmed.length }), 900);
    return () => clearTimeout(timer);
  }, [trimmed]);

  return { universes, teams, heroes, titles, houses, loading, resultCount: heroes.length };
}
