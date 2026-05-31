import { useEffect, useState, useCallback } from 'react';
import type { HeroSearchResult } from '../lib/db/heroes';

export function useSearchSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<HeroSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setResultCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { searchHeroes, rankResults } = await import('../lib/db/heroes');
        const results = await searchHeroes(query, 'All', 100);
        const ranked = rankResults(results, query);

        setResultCount(ranked.length);
        setSuggestions(ranked.slice(0, 8)); // Show top 8
      } catch {
        setSuggestions([]);
        setResultCount(0);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  return { suggestions, isLoading, resultCount };
}
