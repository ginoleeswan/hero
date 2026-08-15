import {
  BREAKPOINTS,
  breakpointFor,
  CONTENT_MAX_WIDTH,
  contentWidth,
  gridColumns,
  heroImageAspect,
  isTabletWidth,
  pagePadding,
  PROSE_MAX_WIDTH,
  railCardWidth,
  sectionGutter,
  snappedColumns,
  spotlightHeightFor,
} from '../../src/constants/layout';
import { podTile } from '../../src/components/home/podGrid';

// Real windows, so a regression reads as a device rather than as a number.
const IPHONE = 390;
const IPHONE_LANDSCAPE = 844;
const IPAD_MINI_PORTRAIT = 744;
const IPAD_PORTRAIT = 834;
const IPAD_LANDSCAPE = 1194;
const SPLIT_THIRD = 320;

describe('breakpointFor', () => {
  it('places the real devices', () => {
    expect(breakpointFor(IPHONE)).toBe('phone');
    expect(breakpointFor(IPAD_MINI_PORTRAIT)).toBe('tablet');
    expect(breakpointFor(IPAD_PORTRAIT)).toBe('tablet');
    expect(breakpointFor(IPAD_LANDSCAPE)).toBe('wide');
  });

  // The threshold has to clear a phone in landscape, or turning a phone
  // sideways would put it into a tablet layout.
  it('keeps a landscape phone out of the tablet band', () => {
    expect(IPHONE_LANDSCAPE).toBeGreaterThan(BREAKPOINTS.tablet);
    // ...which is why this is keyed on the window and the phone is not
    // full-width in landscape by accident — assert the boundary itself.
    expect(breakpointFor(BREAKPOINTS.tablet - 1)).toBe('phone');
    expect(breakpointFor(BREAKPOINTS.tablet)).toBe('tablet');
  });

  // An app in a third of an iPad IS a phone from the reader's side. Asking
  // "is this an iPad" instead would dress a 320pt column as a tablet.
  it('treats a narrow Split View column as a phone', () => {
    expect(breakpointFor(SPLIT_THIRD)).toBe('phone');
    expect(isTabletWidth(SPLIT_THIRD)).toBe(false);
  });
});

describe('pagePadding', () => {
  it('opens up with the window', () => {
    expect(pagePadding(IPHONE)).toBe(15);
    expect(pagePadding(IPAD_PORTRAIT)).toBe(24);
    expect(pagePadding(IPAD_LANDSCAPE)).toBe(32);
  });
});

describe('contentWidth', () => {
  it('fills a phone', () => {
    expect(contentWidth(IPHONE)).toBe(IPHONE - 30);
  });

  it('caps the measure rather than stretching one column across an iPad', () => {
    expect(contentWidth(IPAD_LANDSCAPE)).toBe(CONTENT_MAX_WIDTH);
  });
});

describe('gridColumns', () => {
  it('gains columns with width', () => {
    const phone = gridColumns(IPHONE);
    const pad = gridColumns(IPAD_PORTRAIT);
    const wide = gridColumns(IPAD_LANDSCAPE);
    expect(phone).toBe(3);
    expect(pad).toBeGreaterThan(phone);
    expect(wide).toBeGreaterThanOrEqual(pad);
  });

  // A Split View drag passes through every width in between. A breakpoint
  // table would step across those in visible jumps.
  it('never goes backwards as the window grows', () => {
    let prev = 0;
    for (let w = 300; w <= 1400; w += 10) {
      const n = gridColumns(w);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it('honours its bounds', () => {
    expect(gridColumns(200, 120, 3, 8)).toBe(3);
    expect(gridColumns(4000, 120, 3, 8)).toBeLessThanOrEqual(8);
  });
});

describe('railCardWidth', () => {
  // The whole point: a tablet shows MORE cards, not bigger ones.
  it('leaves the phone alone and fixes the size on a tablet', () => {
    expect(railCardWidth(IPHONE)).toBe(Math.round(IPHONE * 0.6));
    expect(railCardWidth(IPAD_LANDSCAPE)).toBe(260);
  });

  it('never grows a card past what a phone would show', () => {
    const phoneCard = railCardWidth(IPHONE);
    // 60% of an iPad would be 716pt — one and a half cards on screen.
    expect(railCardWidth(IPAD_LANDSCAPE)).toBeLessThan(IPAD_LANDSCAPE * 0.6);
    expect(railCardWidth(IPAD_LANDSCAPE)).toBeGreaterThan(phoneCard);
  });

  // The Arena's battle-builder cards regression: measured at ~840pt on an
  // iPad Pro 13" landscape (1376pt) before this was fixed. 390 is already
  // covered by IPHONE above; these two pin the fixed tablet value at the
  // iPad Pro 11" (1032) and 13" (1376) landscape widths specifically.
  it('is a fixed size at iPad Pro landscape widths, not a bigger proportion', () => {
    expect(railCardWidth(1032)).toBe(260);
    expect(railCardWidth(1376)).toBe(260);
  });
});

describe('spotlightHeightFor', () => {
  it('is half the window on a phone', () => {
    expect(spotlightHeightFor(IPHONE, 844)).toBe(422);
  });

  // Tablet PORTRAIT is the case that bites: half of 1194pt is 597pt on an
  // 834pt-wide screen — a near-square slab that eats the whole fold, so
  // nothing below the billboard is visible until you scroll.
  it('caps against width in tablet portrait', () => {
    const h = spotlightHeightFor(IPAD_PORTRAIT, 1194);
    expect(h).toBeLessThan(1194 * 0.5);
    expect(h).toBe(Math.round(IPAD_PORTRAIT * 0.62));
  });

  // Landscape is already wide relative to its height, so the width cap does
  // not bind and half the window is still the right answer.
  it('leaves landscape at half the window', () => {
    expect(spotlightHeightFor(IPAD_LANDSCAPE, 834)).toBe(417);
  });

  it('adds the safe-area inset', () => {
    expect(spotlightHeightFor(IPHONE, 844, 20)).toBe(442);
  });
});

describe('heroImageAspect', () => {
  // The Apple Zoom transition morphs a rail card into the character page's hero
  // image, and only fills edge to edge while the two are the same shape. They
  // used to agree by both being frozen at launch — which stops being true the
  // first time an iPad rotates. One function, imported by both.
  it('stays a portrait at every window size', () => {
    for (const [w, h] of [
      [IPHONE, 844],
      [IPAD_PORTRAIT, 1194],
      [IPAD_LANDSCAPE, 834],
      [SPLIT_THIRD, 1194],
    ]) {
      expect(heroImageAspect(w, h)).toBeGreaterThanOrEqual(1.1);
      expect(heroImageAspect(w, h)).toBeLessThanOrEqual(1.5);
    }
  });

  // The bug the clamp exists for: raw height*0.66/width drops BELOW 1 on a
  // landscape iPad, so the "portrait" card comes out landscape.
  it('clamps the ratio that would otherwise invert', () => {
    expect((834 * 0.66) / IPAD_LANDSCAPE).toBeLessThan(1);
    expect(heroImageAspect(IPAD_LANDSCAPE, 834)).toBe(1.1);
  });

  it('is unchanged on a phone', () => {
    expect(heroImageAspect(IPHONE, 844)).toBeCloseTo((844 * 0.66) / IPHONE, 5);
  });
});

describe('sectionGutter', () => {
  // THE reason this exists rather than reusing pagePadding: pagePadding's phone
  // value is 15 and Explore's sections were tuned at 16. Adopting pagePadding
  // wholesale would have shifted every heading on every phone by one point,
  // which is exactly the phone-visible diff the tablet work is not allowed to
  // make. So the phone value is the caller's existing literal, passed through.
  it.each([320, 375, 390, 428, 699])('returns the caller’s phone value at %ipt', (w) => {
    expect(sectionGutter(w, 16)).toBe(16);
    expect(sectionGutter(w, 15)).toBe(15);
  });

  it('defaults the phone value to 16 — Explore’s literal', () => {
    expect(sectionGutter(IPHONE)).toBe(16);
  });

  // Above the threshold every caller converges on ONE gutter, whatever phone
  // literal they came from. Two sections disagreeing by a point is invisible on
  // a phone and a visibly ragged left edge on a 1376pt page.
  it('unifies the tablet widths regardless of the phone value', () => {
    for (const phone of [15, 16]) {
      expect(sectionGutter(IPAD_PORTRAIT, phone)).toBe(24);
      expect(sectionGutter(IPAD_LANDSCAPE, phone)).toBe(32);
    }
  });

  it('steps exactly at the breakpoints, not near them', () => {
    expect(sectionGutter(BREAKPOINTS.tablet - 1)).toBe(16);
    expect(sectionGutter(BREAKPOINTS.tablet)).toBe(24);
    expect(sectionGutter(BREAKPOINTS.wide - 1)).toBe(24);
    expect(sectionGutter(BREAKPOINTS.wide)).toBe(32);
  });

  // A third of an iPad is a phone from the reader's side, so it gets the phone
  // gutter — the same window-not-device rule the breakpoints are built on.
  it('gives a Slide Over column the phone gutter', () => {
    expect(sectionGutter(SPLIT_THIRD)).toBe(16);
  });
});

describe('PROSE_MAX_WIDTH', () => {
  // The cap goes on the TEXT, not on the block that holds it: a centred block
  // would give the feed a second left edge, which is the ragged-gutter fault.
  // So this must stay comfortably under a capped content column — if it ever
  // exceeded it, the constant would be doing nothing.
  it('is a measure, not a column', () => {
    expect(PROSE_MAX_WIDTH).toBeLessThan(CONTENT_MAX_WIDTH);
  });

  // Never narrows a phone: the widest phone's content is already under it.
  it('does not bite on a phone', () => {
    expect(IPHONE - sectionGutter(IPHONE) * 2).toBeLessThan(PROSE_MAX_WIDTH);
    expect(428 - sectionGutter(428) * 2).toBeLessThan(PROSE_MAX_WIDTH);
  });
});

describe('the browse grid tiles evenly', () => {
  // BROWSE_PODS is twelve tiles and its own comment promises the grid never
  // strands a short last row. The count used to be clamped to 2–5, and 5 is the
  // one value in that range 12 does not divide: a landscape iPad drew 5 / 5 / 2
  // with three empty slots. This pins the promise rather than the arithmetic.
  // The real function, imported — a test that re-derived the formula would go
  // on passing while the screen drew something else.
  const columnsFor = (w: number) => podTile(w).columns;

  it.each([
    SPLIT_THIRD,
    375,
    IPHONE,
    428,
    IPAD_MINI_PORTRAIT,
    IPAD_PORTRAIT,
    1032,
    IPAD_LANDSCAPE,
    1376,
  ])('divides twelve at %ipt', (w) => {
    expect(12 % columnsFor(w)).toBe(0);
  });

  // The phone stayed two-up before this change and must stay two-up after it.
  it('leaves every phone width at two columns', () => {
    for (const w of [SPLIT_THIRD, 375, IPHONE, 428]) expect(columnsFor(w)).toBe(2);
  });

  it('gains columns with the window', () => {
    expect(columnsFor(IPAD_PORTRAIT)).toBe(4);
    expect(columnsFor(1376)).toBe(6);
  });

  // The tile itself must be byte-identical on a phone: same gutter, same two
  // columns, same 12pt gap, so the same width falls out.
  it('leaves the phone tile exactly where it was', () => {
    const { pad, size } = podTile(IPHONE);
    expect(pad).toBe(16);
    expect(size.width).toBe(Math.floor((IPHONE - 16 * 2 - 12) / 2));
    expect(size.height).toBe(Math.round(size.width * 0.82));
  });

  // Snapping, not rounding: 5.96 columns of ideal width rounds to 6 either way,
  // but 4.4 rounds to 4 and 5.4 would round to 5 — which twelve does not
  // divide. The snap sends it to 6 instead.
  it('snaps past an illegal count rather than rounding into it', () => {
    expect(snappedColumns(1240, 32, [2, 3, 4, 6])).toBe(6);
    expect(Math.round((1240 - 64) / 220)).toBe(5);
  });
});
