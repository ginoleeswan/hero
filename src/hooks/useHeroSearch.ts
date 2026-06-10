import { useEffect, useState } from 'react';
import {
  searchHeroes,
  rankResults,
  type HeroSearchResult,
  type PublisherFilter,
} from '../lib/db/heroes';

// Single debounced hero-search primitive. Both the dedicated results page and
// the nav palette's suggestions ride on this — they differ only in publisher /
// limit / how many rows they show.
export function useHeroSearch(
  query: string,
  publisher: PublisherFilter = 'All',
  limit = 300,
  debounceMs = 250,
) {
  const trimmed = query.trim();
  const hasCriteria = trimmed.length > 0 || publisher !== 'All';
  const [results, setResults] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasCriteria) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchHeroes(trimmed, publisher, limit);
        setResults(trimmed ? rankResults(res, trimmed) : res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [trimmed, publisher, limit, debounceMs, hasCriteria]);

  return { results, loading, hasCriteria };
}
