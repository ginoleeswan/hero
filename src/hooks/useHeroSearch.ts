import { useEffect, useState } from 'react';
import { searchHeroes, type HeroSearchResult, type PublisherFilter } from '../lib/db/heroes';

// Session cache so retyping / backspacing a query is instant — the common case
// while typing ("spider" → "spide" → "spider") never re-hits the network. Capped
// FIFO to avoid unbounded growth.
const cache = new Map<string, HeroSearchResult[]>();
const CACHE_MAX = 80;
function cacheSet(key: string, val: HeroSearchResult[]) {
  cache.set(key, val);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

// Single debounced hero-search primitive. Both the dedicated results page and
// the nav palette's suggestions ride on this — they differ only in publisher /
// limit / how many rows they show.
//
// Feels-fast behaviour: a cache hit returns synchronously (no spinner), and on a
// miss the PREVIOUS results stay visible while the new query resolves (no
// per-keystroke skeleton flash — `loading` just turns true alongside them).
export function useHeroSearch(
  query: string,
  publisher: PublisherFilter = 'All',
  limit = 80,
  debounceMs = 180,
) {
  const trimmed = query.trim();
  const hasCriteria = trimmed.length > 0 || publisher !== 'All';
  const [results, setResults] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasCriteria) {
      // Clear results when there's nothing to search. Effect-based fetch
      // (pre-React-Query); reset guards a stale flash before the next fetch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setLoading(false);
      return;
    }

    const key = `${trimmed}|${publisher}|${limit}`;
    const cached = cache.get(key);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    // keepPreviousData: intentionally DON'T clear `results` here — the prior set
    // stays on screen while the next query resolves, so typing doesn't flash.
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        // The search_heroes RPC already ranks by blended match-tier + fame_score,
        // so we trust its order (re-ranking client-side would undo the fame blend).
        const rows = await searchHeroes(trimmed, publisher, limit);
        if (cancelled) return;
        cacheSet(key, rows);
        setResults(rows);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, publisher, limit, debounceMs, hasCriteria]);

  return { results, loading, hasCriteria };
}
