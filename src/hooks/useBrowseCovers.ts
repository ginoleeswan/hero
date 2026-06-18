import { useEffect, useState } from 'react';
import type { BrowseCover, CategorySlug } from '../lib/db/heroes';
import { BROWSE_PODS } from '../components/home/CategoryPodGrid';

// Module-level cache so the browse-pod art loads once per session, not per focus.
// Pods render fine before this resolves (text-on-navy fallback), so the fetch is
// non-blocking — it only upgrades the tiles to character art when it lands.
let cache: Record<string, BrowseCover> | null = null;

export function useBrowseCovers(enabled = true) {
  const [covers, setCovers] = useState<Record<string, BrowseCover>>(cache ?? {});

  useEffect(() => {
    if (!enabled || cache) return;

    let cancelled = false;
    (async () => {
      try {
        const { getBrowseCovers } = await import('../lib/db/heroes');
        const result = await getBrowseCovers(BROWSE_PODS.map((p) => p.slug as CategorySlug));
        if (cancelled) return;
        cache = result;
        setCovers(result);
      } catch {
        if (!cancelled) setCovers({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return covers;
}
