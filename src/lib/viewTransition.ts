import { flushSync } from 'react-dom';

type ViewTransition = { finished?: Promise<unknown> };
type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => unknown) => ViewTransition;
};

/**
 * Run a navigation (or any DOM-affecting update) inside the browser's View
 * Transition API so shared `view-transition-name` elements morph between the
 * old and new screens. The update is committed synchronously with `flushSync`
 * inside the callback — using `requestAnimationFrame` here would deadlock,
 * because the browser suspends rendering (and therefore rAF) until the callback
 * resolves. Falls back to a plain update where the API is unavailable
 * (Firefox/Safari) or off the web.
 *
 * Returns the `ViewTransition` (or null in the fallback) so callers can await
 * `.finished` — e.g. to drop a transient `view-transition-name` once the morph
 * completes, which matters when the departing screen stays mounted (a `push`,
 * not a `replace`) and would otherwise leave two elements claiming one name.
 */
export function withViewTransition(run: () => void): ViewTransition | null {
  const doc = typeof document !== 'undefined' ? (document as ViewTransitionDoc) : undefined;
  if (doc?.startViewTransition) {
    return doc.startViewTransition(() => flushSync(() => run()));
  }
  run();
  return null;
}

/**
 * Shared name for the hero-portrait morph: a list/grid card's art morphs into
 * the character detail page's portrait. Distinct from the compare flow's names
 * so the two never collide (only one name-pair is ever active per navigation).
 */
export const VT_PORTRAIT = 'vt-hero-portrait';

// One-shot latch handshaking a morph between the departing card and the
// arriving detail page. Both screens live in the same JS session under
// expo-router client-side nav, so a module variable reaches across the
// navigation; on a hard load it is simply null → no morph → fine.
let pendingMorphHeroId: string | null = null;

/** Called by a card right before it navigates, so the detail page knows to tag its portrait. */
export function markMorphDeparture(heroId: string): void {
  pendingMorphHeroId = heroId;
}

/**
 * Read-and-clear: true only when we arrived via a morph for *this* hero. Clears
 * the latch so an unrelated later navigation can't inherit a stale morph.
 */
export function consumeMorphArrival(heroId: string): boolean {
  const hit = pendingMorphHeroId === heroId;
  pendingMorphHeroId = null;
  return hit;
}
