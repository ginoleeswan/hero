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

/** The art a card already holds, handed to the detail page so it can paint the
 *  portrait immediately — before its own stats query resolves. */
export interface MorphArt {
  id: string;
  name?: string | null;
  image_url?: string | null;
  portrait_url?: string | null;
  /** BlurHash for the portrait — shown instantly so the morph target never
   *  blanks while the full-res detail image loads. Also feeds the detail
   *  page's theme derivation, so the skeleton paints the character's own
   *  accent palette (stage bloom, halo, hairline) before stats load. */
  blurhash?: string | null;
  /** Publisher — the theme's fallback signal when there's no blurhash. */
  publisher?: string | null;
  /** The exact image the card was showing, so the morph target can paint that
   *  same (already-cached) derivative and the morph is crisp→crisp instead of
   *  crisp→blur. `grid`/`gridWidth`/`image_md_url` mirror the card's HeroImage
   *  props so the resolved Cloudinary URL — and thus the cache hit — matches. */
  image_md_url?: string | null;
  grid?: boolean;
  gridWidth?: number;
}

// One-shot latch handshaking a morph between the departing card and the
// arriving detail page. Both screens live in the same JS session under
// expo-router client-side nav, so a module variable reaches across the
// navigation; on a hard load it is simply null → no morph → fine. The art
// rides along so the detail page can paint the portrait in its skeleton state
// (the detail stats load async — without this the View Transition would have
// nothing to morph into on a cache miss, and only cached heroes would morph).
let pendingMorph: MorphArt | null = null;

/** Called by a card right before it navigates, so the detail page knows to tag
 *  (and paint) its portrait. */
export function markMorphDeparture(art: MorphArt): void {
  pendingMorph = art;
}

/**
 * Read-and-clear: returns the stashed art only when we arrived via a morph for
 * *this* hero, else null. Clears the latch so an unrelated later navigation
 * can't inherit a stale morph.
 */
export function consumeMorphArrival(heroId: string): MorphArt | null {
  const hit = pendingMorph?.id === heroId ? pendingMorph : null;
  pendingMorph = null;
  return hit;
}

// ── Return morph (detail → card) ──────────────────────────────────────────────
// The forward morph grows a card into the detail portrait; the return morph
// plays the film in reverse — the detail portrait shrinks back into the exact
// card it came from. The detail page's back button calls beginMorphReturn(id)
// and navigates inside a view transition; every hero card (via useHeroMorph)
// subscribes to this store, and the one matching card tags itself with the
// shared name for the transition's "new" snapshot. endMorphReturn() un-tags it
// once the morph settles. If no card matches (deep link, different screen), the
// name is simply unpaired and the transition falls back to the root cross-fade.
let returnTargetId: string | null = null;
// Exactly ONE card may claim the name per return (duplicate names abort the
// whole transition — e.g. the same hero in two explore rows). First claimant
// wins; claims reset when the target changes.
let returnClaimedBy: symbol | null = null;
const returnSubs = new Set<() => void>();

export function beginMorphReturn(heroId: string): void {
  returnTargetId = heroId;
  returnClaimedBy = null;
  returnSubs.forEach((cb) => cb());
}

export function endMorphReturn(): void {
  if (returnTargetId === null) return;
  returnTargetId = null;
  returnClaimedBy = null;
  returnSubs.forEach((cb) => cb());
}

export function subscribeMorphReturn(cb: () => void): () => void {
  returnSubs.add(cb);
  return () => returnSubs.delete(cb);
}

export function getMorphReturnId(): string | null {
  return returnTargetId;
}

/** First caller with the matching target wins the tag (per return); callers
 *  must pass a stable token so re-renders keep their claim. */
export function claimMorphReturn(heroId: string, token: symbol): boolean {
  if (returnTargetId !== heroId) return false;
  if (returnClaimedBy === null) returnClaimedBy = token;
  return returnClaimedBy === token;
}
