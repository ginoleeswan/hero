import { useQuery } from '@tanstack/react-query';
import type { BrowseCover, CategorySlug } from '../lib/db/heroes';
import { BROWSE_PODS } from '../components/home/CategoryPodGrid';

/**
 * Cover art for the browse pods (Search's grid; Explore gets its copy inside
 * the explore bundle).
 *
 * This was a hand-rolled module-level cache with a `catch { setCovers({}) }`,
 * and that catch was hiding a real failure. `get_browse_covers` can exceed the
 * 3s anon statement_timeout on a COLD cache — measured against the live
 * endpoint, `strongest` returned HTTP 500 at 3.7s, then 3.09s, then 0.41s and
 * 0.47s as the pages warmed. `most-intelligent` behaves the same way. So the
 * very first visit after those pages fall out of cache got nothing, swallowed
 * the error, and rendered letter monograms with no way back — which is exactly
 * the "category cards don't look like they're loading in" report.
 *
 * React Query with retries fixes the client half: attempt one may hit the cold
 * timeout, attempt two lands warm and the tiles fill in. The pods already
 * render a fallback while it resolves, so a retry costs nothing visually.
 *
 * The SERVER half is still outstanding — the RPC should not need a warm cache
 * to answer inside 3s. `browse_cover_pool` filters with `case p_slug ... end`,
 * a CASE over a runtime parameter, which no index can serve; every slug is a
 * fame-ordered walk with a per-row filter. That needs an EXPLAIN and probably
 * a partial index, and is tracked separately.
 */
export function useBrowseCovers(enabled = true) {
  const { data } = useQuery({
    queryKey: ['browse-covers'],
    queryFn: async () => {
      const { getBrowseCovers } = await import('../lib/db/heroes');
      return getBrowseCovers(BROWSE_PODS.map((p) => p.slug as CategorySlug));
    },
    enabled,
    // The art is editorial, not live data — once it lands it can sit for the
    // session. gcTime keeps it across tab switches.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // Three attempts: the cold path needs roughly two to warm the pages.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  return data ?? EMPTY;
}

// Stable identity so consumers don't re-render on every call while loading.
const EMPTY: Record<string, BrowseCover> = {};
