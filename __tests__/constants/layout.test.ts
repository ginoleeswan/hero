import {
  BREAKPOINTS,
  breakpointFor,
  CONTENT_MAX_WIDTH,
  contentWidth,
  gridColumns,
  heroImageAspect,
  isTabletWidth,
  pagePadding,
  railCardWidth,
  spotlightHeightFor,
} from '../../src/constants/layout';

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
