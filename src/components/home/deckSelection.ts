// src/components/home/deckSelection.ts — which cards the tablet stage shows.
//
// Pure, and separate from the view, because the repo's testing convention rules
// out rendering tests for screens: if the selection logic lived inside
// SpotlightDeck it would ship untested. The component's job is to draw what this
// returns, nothing more.
import type { SpotlightLayout } from '../../constants/spotlightLayout';
import type { Hero } from '../../lib/db/heroes';

/**
 * Depth taper — the active card is fully lit and each sliver behind it sits a
 * step further back. The same ramp the web deck uses, so a character reads at
 * the same depth on both platforms.
 */
export const SLIVER_OPACITY: readonly number[] = [1, 0.82, 0.66, 0.54, 0.44, 0.36, 0.28, 0.2];

/**
 * Wraps a possibly-stale active index back into range for the current list —
 * the same modulo `deckCards` already applies internally. A feed refetch can
 * shrink `heroes` out from under a still-mounted `active` state; without this,
 * the panel (`heroes[active]`) and the deck's front card would either crash
 * on `undefined` or silently disagree about which hero is active.
 */
export function resolveActiveIndex(activeIndex: number, length: number): number {
  if (length === 0) return 0;
  return ((activeIndex % length) + length) % length;
}

export interface DeckCard {
  hero: Hero;
  /** Index into `heroes` — what a tap on this card promotes to active. */
  index: number;
  width: number;
  opacity: number;
  active: boolean;
  /** The card directly behind the active one — shown at a smaller, dimmer
   *  name treatment (web's `cardNameNext`) so the deck previews what's next. */
  next: boolean;
}

/**
 * One entry per hero, in the heroes array's own stable order — never
 * reordered by taper position. Each entry carries the width its distance
 * (`offset`) from the active card assigns: the active hero gets the full
 * card width, each step behind it gets the next sliver width, and anything
 * past the end of the taper gets a width of zero (and zero opacity) while
 * still holding a slot.
 *
 * Returning entries in a stable per-hero order — rather than reordered by
 * offset, as a naive "slice the taper" approach would — is the whole point:
 * a hero keeps the same array position (and the same React key upstream)
 * across every advance, so the view can animate each card's width in place
 * instead of remounting into a new position. That width animation IS the
 * carousel's motion (see web's `explore.web.tsx` strip comment) — it only
 * works if nothing swaps slots underneath it.
 */
export function deckCards(
  heroes: Hero[],
  layout: Pick<SpotlightLayout, 'cardWidth' | 'tail'>,
  activeIndex: number,
): DeckCard[] {
  if (heroes.length === 0) return [];
  const widths = [layout.cardWidth, ...layout.tail].slice(0, heroes.length);
  return heroes.map((hero, index) => {
    const offset = (index - activeIndex + heroes.length) % heroes.length;
    const isVisible = offset < widths.length;
    return {
      hero,
      index,
      width: isVisible ? widths[offset] : 0,
      opacity: isVisible ? SLIVER_OPACITY[Math.min(offset, SLIVER_OPACITY.length - 1)] : 0,
      active: offset === 0,
      next: offset === 1,
    };
  });
}
