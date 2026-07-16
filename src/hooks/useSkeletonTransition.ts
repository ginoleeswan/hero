// src/hooks/useSkeletonTransition.ts
// Drives a four-phase skeleton→content transition from a single `loading` flag,
// so the swap reads as a true cross-dissolve rather than a hard cut or a blink:
//   pre        — loading, within the delay window: show nothing (a bare shell),
//                so instant/cached loads never flash a half-frame of skeleton.
//   skeleton   — loading has outlasted the delay: show the skeleton.
//   crossfade  — loaded AND a skeleton was on screen: render the real content and
//                dissolve the skeleton out on top of it (placeholders resolve in
//                place).
//   content    — loaded; skeleton gone.
// Loads that resolve within `delay` skip straight to `content` (no skeleton, so
// nothing to dissolve).
import { useLayoutEffect, useRef, useState } from 'react';

export type SkeletonPhase = 'pre' | 'skeleton' | 'crossfade' | 'content';

interface Options {
  /** Wait this long before showing the skeleton at all. */
  delay?: number;
  /** How long the skeleton dissolves over the loaded content (match the visual fade). */
  crossfade?: number;
  /**
   * Skip the `pre` window: show the skeleton on the very first frame AND
   * guarantee the crossfade when data lands (even if it lands inside `delay`).
   * For arrivals where the skeleton is itself part of the choreography — e.g. a
   * card→detail view-transition morph lands on the skeleton's portrait, so it
   * must be painted at snapshot time and must dissolve out, never hard-cut.
   */
  immediate?: boolean;
}

export function useSkeletonTransition(
  loading: boolean,
  { delay = 150, crossfade = 320, immediate = false }: Options = {},
): SkeletonPhase {
  const [phase, setPhase] = useState<SkeletonPhase>(
    loading ? (immediate ? 'skeleton' : 'pre') : 'content',
  );
  // Whether the skeleton actually reached the screen this loading spell — decides
  // crossfade (dissolve it out) vs. straight-to-content (it never showed).
  const shown = useRef(immediate && loading);

  // Layout effect so the loaded→crossfade switch lands BEFORE paint — otherwise
  // the first content frame would flash bare for a tick before the overlay mounts.
  // Skeleton crossfade state machine: phase is driven by `loading` plus timers,
  // so the transitions genuinely belong in a (layout) effect.
  useLayoutEffect(() => {
    if (loading) {
      if (immediate) {
        shown.current = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPhase('skeleton');
        return;
      }
      shown.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('pre');
      const t = setTimeout(() => {
        shown.current = true;
        setPhase('skeleton');
      }, delay);
      return () => clearTimeout(t);
    }
    if (shown.current) {
      setPhase('crossfade');
      const t = setTimeout(() => setPhase('content'), crossfade);
      return () => clearTimeout(t);
    }
    setPhase('content');
  }, [loading, delay, crossfade, immediate]);

  return phase;
}
