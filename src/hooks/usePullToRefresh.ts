import { useEffect, useRef, useState } from 'react';

// Lightweight pull-to-refresh for web document scroll (RN-web has no working
// RefreshControl). When the page is scrolled to the very top, a downward drag past
// the threshold fires `onRefresh`. Returns the live pull `distance` (px, resisted)
// and a `refreshing` flag so a caller can render a spinner. Web/touch only — inert
// where there's no `window`/touch.
const THRESHOLD = 64; // resisted px to trigger
const MAX = 96; // resisted px cap

export function usePullToRefresh(onRefresh: () => void | Promise<void>, enabled = true) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Keep the latest callback without re-subscribing listeners every render.
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    let startY: number | null = null;
    let dist = 0;
    let busy = false;
    const setD = (d: number) => {
      dist = d;
      setDistance(d);
    };

    const onStart = (e: TouchEvent) => {
      if (busy || window.scrollY > 0) {
        startY = null;
        return;
      }
      startY = e.touches[0]?.clientY ?? null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null || busy) return;
      const dy = (e.touches[0]?.clientY ?? startY) - startY;
      if (dy <= 0) {
        if (dist) setD(0);
        return;
      }
      setD(Math.min(MAX, dy * 0.5)); // rubber-band resistance
    };
    const onEnd = async () => {
      if (startY == null) return;
      startY = null;
      if (dist >= THRESHOLD && !busy) {
        busy = true;
        setRefreshing(true);
        setD(THRESHOLD);
        try {
          await cbRef.current();
        } finally {
          busy = false;
          setRefreshing(false);
          setD(0);
        }
      } else {
        setD(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return { distance, refreshing };
}
