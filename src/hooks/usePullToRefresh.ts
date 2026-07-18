import { useEffect, useRef, useState } from 'react';

// Pull-to-refresh for web document scroll (RN-web has no working RefreshControl).
// When the page is scrolled to the very top, a downward drag past the threshold
// fires `onRefresh`; the indicator stays up until that promise settles, so it
// reflects the REAL refresh, not just the gesture. Returns the resisted pull
// `distance`, a 0→1 `progress` toward the trigger, an `armed` flag (past the
// threshold — release will refresh), a `dragging` flag (finger down, so the
// indicator follows with no transition), and `refreshing`. Web/touch only.
const THRESHOLD = 64; // resisted px to trigger
const MAX = 96; // resisted px cap

export function usePullToRefresh(onRefresh: () => void | Promise<void>, enabled = true) {
  const [distance, setDistance] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Keep the latest callback without re-subscribing listeners every render.
  const cbRef = useRef(onRefresh);
  useEffect(() => {
    cbRef.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    let startY: number | null = null;
    let dist = 0;
    let busy = false;
    let armed = false;
    const set = (d: number, drag: boolean) => {
      dist = d;
      setDistance(d);
      setDragging(drag);
    };
    // A single soft tick when the pull crosses the trigger — the same "you can
    // let go now" cue native pull-to-refresh gives. Android honours it; iOS
    // Safari has no web vibration, so it's simply a no-op there.
    const tick = () => {
      try {
        navigator.vibrate?.(9);
      } catch {
        /* unsupported */
      }
    };

    const onStart = (e: TouchEvent) => {
      if (busy || window.scrollY > 0) {
        startY = null;
        return;
      }
      startY = e.touches[0]?.clientY ?? null;
      armed = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null || busy) return;
      const dy = (e.touches[0]?.clientY ?? startY) - startY;
      if (dy <= 0) {
        if (dist) set(0, true);
        return;
      }
      const d = Math.min(MAX, dy * 0.5); // rubber-band resistance
      const nowArmed = d >= THRESHOLD;
      if (nowArmed && !armed) tick();
      armed = nowArmed;
      set(d, true);
    };
    const onEnd = async () => {
      if (startY == null) return;
      startY = null;
      if (dist >= THRESHOLD && !busy) {
        busy = true;
        setRefreshing(true);
        // dragging → false so the pill settles at the threshold and holds while
        // the refresh runs, then transitions away when it resolves.
        set(THRESHOLD, false);
        try {
          await cbRef.current();
        } finally {
          busy = false;
          armed = false;
          setRefreshing(false);
          set(0, false);
        }
      } else {
        set(0, false); // released short → smooth spring back
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

  return {
    distance,
    progress: Math.min(1, distance / THRESHOLD),
    armed: distance >= THRESHOLD,
    dragging,
    refreshing,
  };
}
