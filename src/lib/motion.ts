// Shared motion primitives for the web experience. Durations, the two easing
// curves the codebase already leans on, and a single SSR-safe reduced-motion
// probe. Everything here is inert data + one pure function, so it is safe to
// import from platform-neutral components (native simply never reads the web
// CSS values).

/** Animation durations in milliseconds. */
export const MOTION = {
  fast: 150, // hover / pressed feedback
  base: 200, // most property transitions
  entrance: 600, // Reveal-style scroll entrances (matches Reveal.tsx)
  stagger: 50, // per-item cascade delay
  staggerCap: 8, // max items that stagger; the rest arrive with item 8
} as const;

/** Decisive settle — fast out, gentle landing. Used by Reveal, MatchupCard. */
export const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Playful overshoot — springs slightly past then back. Used by ShowdownStage. */
export const EASE_OVERSHOOT = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/**
 * True when the user has asked the OS to minimise motion. SSR-safe and
 * web-safe: returns false during static render and on native (no matchMedia),
 * so callers fall through to their non-animated branch there.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}
