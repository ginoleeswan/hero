import { useEffect, useState } from 'react';
import { getTrendingTeams, type TeamSearchResult } from '../lib/db/teams';
import { getTrendingTitles, type TitleSearchResult } from '../lib/db/titles';

interface Showcase {
  teams: TeamSearchResult[];
  films: TitleSearchResult[];
}

// Module-level cache so the empty-search showcase (featured teams + popular films)
// loads once per session, not every time the palette opens.
let cache: Showcase | null = null;

export function useIdleShowcase(enabled: boolean): Showcase {
  const [data, setData] = useState<Showcase>(cache ?? { teams: [], films: [] });

  useEffect(() => {
    if (!enabled || cache) return;
    let cancelled = false;
    (async () => {
      try {
        const [teams, films] = await Promise.all([getTrendingTeams(2), getTrendingTitles(2)]);
        if (cancelled) return;
        cache = { teams, films };
        setData(cache);
      } catch {
        /* showcase is best-effort — a failure just hides those rows */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return data;
}
