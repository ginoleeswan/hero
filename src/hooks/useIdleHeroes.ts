import { useEffect, useState } from 'react';
import type { HeroSearchResult } from '../lib/db/heroes';

// Module-level cache so trending heroes load once per session, not per focus.
let cache: HeroSearchResult[] | null = null;

export function useIdleHeroes(enabled: boolean, limit = 6) {
  const [heroes, setHeroes] = useState<HeroSearchResult[]>(cache ?? []);
  const [isLoading, setIsLoading] = useState(!cache);

  useEffect(() => {
    if (!enabled || cache) return;

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const { getSearchIdleHeroes } = await import('../lib/db/heroes');
        const results = await getSearchIdleHeroes(limit);
        if (cancelled) return;
        cache = results;
        setHeroes(results);
      } catch {
        if (!cancelled) setHeroes([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, limit]);

  return { heroes: heroes.slice(0, limit), isLoading };
}
