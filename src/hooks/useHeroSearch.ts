import { useEffect, useState } from 'react';
import { searchHeroes, type HeroSearchResult, type PublisherFilter } from '../lib/db/heroes';

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
        // The search_heroes RPC already ranks by blended match-tier + fame_score,
        // so we trust its order (re-ranking client-side would undo the fame blend).
        setResults(await searchHeroes(trimmed, publisher, limit));
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
