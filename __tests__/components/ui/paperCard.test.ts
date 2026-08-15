import { PAPER_CARD_SURFACE } from '../../../src/components/ui/PaperCard';

// These mirror scripts/ui/check-ui-invariants.mjs. The primitive that exists to
// DRAIN the off-scale counts must not itself be off-scale, or every adoption
// would trade one violation for another and the ratchet would never move.
const RADIUS_SCALE = new Set([4, 8, 12, 16, 20, 24, 999]);

describe('PAPER_CARD_SURFACE', () => {
  it('is on the radius scale', () => {
    expect(RADIUS_SCALE.has(PAPER_CARD_SURFACE.borderRadius)).toBe(true);
  });

  // The modal value of the sixty hand-rolled surfaces, not a new invention.
  // Eight different alphas were in use; this is the one that was most common,
  // so the majority of adoptions are a pure deletion with no visual diff.
  it('keeps the ink hairline the sites already used', () => {
    expect(PAPER_CARD_SURFACE.borderColor).toBe('rgba(41,60,67,0.1)');
    expect(PAPER_CARD_SURFACE.borderWidth).toBe(1);
  });

  // White on beige. A card that inherits the page's beige is not a card, and
  // two sites had drifted to '#faf6ee' / '#fffdf9' which read as smudges.
  it('is paper, not the page', () => {
    expect(PAPER_CARD_SURFACE.backgroundColor).toBe('#fff');
  });
});
