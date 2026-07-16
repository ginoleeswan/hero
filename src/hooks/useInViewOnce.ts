// One-shot viewport-entry detector (web). Returns false until the observed
// element first scrolls into view, then latches true and disconnects the
// observer. Returns true immediately — i.e. "treat it as already seen" — when
// there is nothing to observe against: SSR, no IntersectionObserver, or the
// user prefers reduced motion. Callers use the boolean to gate an entrance
// animation, so "already seen" correctly means "render settled, no animation".
import { useEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface Options {
  /** Passed straight to IntersectionObserver. */
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * @param ref  ref to the element to watch. On web RNW renders `View` as a DOM
 *             node, so a `View` ref works here once cast by the caller.
 */
export function useInViewOnce(
  ref: RefObject<{ current: unknown } | unknown>,
  { rootMargin = '0px 0px -8% 0px', threshold = 0.05 }: Options = {},
): boolean {
  const [seen, setSeen] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      prefersReducedMotion(),
  );
  // Guard against re-observing after we've latched.
  const done = useRef(seen);

  useEffect(() => {
    if (done.current) return;
    // RNW renders View as a DOM element at runtime.
    const el = (ref as RefObject<unknown>).current as HTMLElement | null;
    if (!el) {
      // Nothing to observe — never leave the caller waiting. Defer the flip a
      // tick so it doesn't fire synchronously inside the effect body.
      const t = setTimeout(() => {
        done.current = true;
        setSeen(true);
      }, 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          done.current = true;
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, threshold]);

  return seen;
}
