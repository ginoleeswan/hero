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
  it('gives every hero an entry, in the heroes-array order', () => {
    const cards = deckCards(heroes, layout, 2);
    expect(cards).toHaveLength(heroes.length);
    expect(cards.map((c) => c.hero.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps entries in heroes-array order across advances', () => {
    for (let active = 0; active < heroes.length; active += 1) {
      const cards = deckCards(heroes, layout, active);
      expect(cards.map((c) => c.hero.id)).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('gives the active hero the full card width and full opacity', () => {
    const cards = deckCards(heroes, layout, 2);
    const activeCard = cards[2];
    expect(activeCard.hero.id).toBe('c');
    expect(activeCard.width).toBe(280);
    expect(activeCard.opacity).toBe(1);
    expect(activeCard.active).toBe(true);
  });

  it('wraps the taper around the end of the list', () => {
    // active = 3 ('d'): next in taper order is 'a', then 'b', then 'c'.
    const cards = deckCards(heroes, layout, 3);
    expect(cards.find((c) => c.hero.id === 'd')?.width).toBe(280); // offset 0
    expect(cards.find((c) => c.hero.id === 'a')?.width).toBe(140); // offset 1
    expect(cards.find((c) => c.hero.id === 'b')?.width).toBe(100); // offset 2
    expect(cards.find((c) => c.hero.id === 'c')?.width).toBe(76); // offset 3
  });

  it('gives heroes past the taper a width of zero', () => {
    // Only 3 widths available (cardWidth + 2 tail) for 4 heroes.
    const shortLayout = { cardWidth: 276, tail: [138, 99] };
    const cards = deckCards(heroes, shortLayout, 0);
    expect(cards).toHaveLength(4);
    const beyondTaper = cards.find((c) => c.hero.id === 'd');
    expect(beyondTaper?.width).toBe(0);
    expect(beyondTaper?.opacity).toBe(0);
    expect(beyondTaper?.active).toBe(false);
    expect(beyondTaper?.next).toBe(false);
  });

  it('never gives more visible (width > 0) entries than there are heroes', () => {
    const cards = deckCards(heroes.slice(0, 2), layout, 0);
    expect(cards.filter((c) => c.width > 0)).toHaveLength(2);
  });

  it('never gives more visible entries than the layout has widths for', () => {
    const shortLayout = { cardWidth: 276, tail: [138, 99] };
    const cards = deckCards(heroes, shortLayout, 0);
    expect(cards.filter((c) => c.width > 0)).toHaveLength(3);
    expect(cards.map((c) => c.width)).toEqual([276, 138, 99, 0]);
  });

  it('recedes: opacity is non-increasing across the visible run, in taper order', () => {
    const cards = deckCards(heroes, layout, 0);
    const byOffset = [...cards].sort((a, b) => a.index - b.index);
    for (let i = 1; i < byOffset.length; i += 1) {
      expect(byOffset[i].opacity).toBeLessThanOrEqual(byOffset[i - 1].opacity);
    }
  });

  it('carries the index a tap needs to promote a sliver — its own position', () => {
    const cards = deckCards(heroes, layout, 1);
    expect(cards.map((c) => c.index)).toEqual([0, 1, 2, 3]);
  });

  it('flags exactly the taper-offset-1 card as next, mirroring web cardNameNext', () => {
    const cards = deckCards(heroes, layout, 2);
    expect(cards.find((c) => c.hero.id === 'c')?.next).toBe(false); // active
    expect(cards.find((c) => c.hero.id === 'd')?.next).toBe(true); // offset 1
    expect(cards.find((c) => c.hero.id === 'a')?.next).toBe(false); // offset 2
    expect(cards.find((c) => c.hero.id === 'b')?.next).toBe(false); // offset 3
    expect(cards.filter((c) => c.next)).toHaveLength(1);
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
