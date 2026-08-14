import {
  deckCards,
  resolveActiveIndex,
  SLIVER_OPACITY,
} from '../../../src/components/home/deckSelection';
import type { Hero } from '../../../src/lib/db/heroes';

// Only the fields the deck reads. Cast once here rather than building 34 columns
// of Hero for a geometry test.
const hero = (id: string): Hero => ({ id, name: id }) as unknown as Hero;
const heroes = ['a', 'b', 'c', 'd'].map(hero);
const layout = { cardWidth: 280, tail: [140, 100, 76, 54] };

describe('deckCards', () => {
  it('leads with the active hero at the full card width', () => {
    const cards = deckCards(heroes, layout, 2);
    expect(cards[0].hero.id).toBe('c');
    expect(cards[0].width).toBe(280);
    expect(cards[0].opacity).toBe(1);
    expect(cards[0].active).toBe(true);
  });

  it('wraps around the deck rather than running off the end', () => {
    const cards = deckCards(heroes, layout, 3);
    expect(cards.map((c) => c.hero.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('never shows more cards than there are heroes', () => {
    const cards = deckCards(heroes.slice(0, 2), layout, 0);
    expect(cards).toHaveLength(2);
  });

  it('never shows more cards than the layout has widths for', () => {
    const cards = deckCards(heroes, { cardWidth: 276, tail: [138, 99] }, 0);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.width)).toEqual([276, 138, 99]);
  });

  it('recedes: each card is lit no more brightly than the one in front', () => {
    const cards = deckCards(heroes, layout, 0);
    for (let i = 1; i < cards.length; i += 1) {
      expect(cards[i].opacity).toBeLessThanOrEqual(cards[i - 1].opacity);
    }
  });

  it('carries the index a tap needs to promote a sliver', () => {
    const cards = deckCards(heroes, layout, 1);
    expect(cards.map((c) => c.index)).toEqual([1, 2, 3, 0]);
  });

  it('has an opacity for every width the taper can produce', () => {
    // buildTail tops out at 7 slivers, so 8 cards is the deepest deck.
    expect(SLIVER_OPACITY.length).toBeGreaterThanOrEqual(8);
  });

  it('returns nothing when there is nothing to show', () => {
    expect(deckCards([], layout, 0)).toEqual([]);
  });
});

describe('resolveActiveIndex', () => {
  it('wraps an index past the end of a shrunken list', () => {
    // A refetch can drop entries out from under a still-mounted `active`
    // state; this must land back in range the same way deckCards wraps.
    expect(resolveActiveIndex(5, 3)).toBe(2);
  });

  it('returns 0 for a single-hero list regardless of the stale index', () => {
    expect(resolveActiveIndex(7, 1)).toBe(0);
  });

  it('returns 0 when the list is empty', () => {
    expect(resolveActiveIndex(4, 0)).toBe(0);
  });

  it('leaves a valid in-range index unchanged', () => {
    expect(resolveActiveIndex(2, 4)).toBe(2);
  });
});
