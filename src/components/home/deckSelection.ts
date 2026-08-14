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
}

/**
 * The active hero first at the full card width, then the deck behind it in
 * order, each at its own sliver width. Wraps, so a deck near the end of the
 * list keeps its taper instead of thinning out.
 */
export function deckCards(
  heroes: Hero[],
  layout: Pick<SpotlightLayout, 'cardWidth' | 'tail'>,
  activeIndex: number,
): DeckCard[] {
  if (heroes.length === 0) return [];
  const widths = [layout.cardWidth, ...layout.tail].slice(0, heroes.length);
  return widths.map((width, i) => {
    const index = (activeIndex + i) % heroes.length;
    return {
      hero: heroes[index],
      index,
      width,
      opacity: SLIVER_OPACITY[Math.min(i, SLIVER_OPACITY.length - 1)],
      active: i === 0,
    };
  });
}
