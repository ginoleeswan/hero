import { spotlightLayout, summaryLineBudget } from '../../src/constants/spotlightLayout';

// The layout's job is to hold a set of promises at EVERY width, so the tests
// are those promises rather than a table of expected numbers.
const WIDTHS: number[] = [];
for (let w = 320; w <= 2560; w += 1) WIDTHS.push(w);

describe('spotlightLayout', () => {
  it('never slices the portrait into a ribbon', () => {
    // The bug this whole module exists to prevent: a fixed stage height with
    // shrinking card widths took the crop to 0.31 at 820px.
    for (const w of WIDTHS) {
      const { state, cardWidth, stageHeight } = spotlightLayout(w);
      const aspect = cardWidth / stageHeight;
      expect(aspect).toBeGreaterThanOrEqual(0.5);
      // A card in a row has to stay portrait. The stacked masthead is a
      // different object — full-bleed art under the nav — so it may run wide,
      // but never so wide it stops being a portrait crop.
      expect(aspect).toBeLessThanOrEqual(state === 'stacked' ? 1.6 : 1.0);
    }
  });

  it('bleeds the stacked masthead to the full viewport', () => {
    for (const w of [320, 390, 430, 560, 719]) {
      const l = spotlightLayout(w);
      expect(l.state).toBe('stacked');
      expect(l.cardWidth).toBe(w);
    }
  });

  it('keeps the stage a hero rather than a wall', () => {
    for (const w of WIDTHS) {
      const { stageHeight } = spotlightLayout(w);
      expect(stageHeight).toBeGreaterThanOrEqual(300);
      expect(stageHeight).toBeLessThanOrEqual(540);
    }
  });

  it('shows a deck or nothing — never one orphaned sliver', () => {
    for (const w of WIDTHS) {
      const { tail } = spotlightLayout(w);
      if (tail.length === 0) continue;
      expect(tail.length).toBeGreaterThanOrEqual(2);
      // The first two have to read as cards; the rest may taper to an edge.
      expect(tail[1]).toBeGreaterThanOrEqual(64);
      // Widest first, always descending.
      for (let i = 1; i < tail.length; i += 1) expect(tail[i]).toBeLessThan(tail[i - 1]);
    }
  });

  it('leaves the panel a readable measure in the deck states', () => {
    for (const w of WIDTHS) {
      const l = spotlightLayout(w);
      if (l.state !== 'gallery' && l.state !== 'duo') continue;
      const available = w - l.gutter * 2;
      const strip = [l.cardWidth, ...l.tail].reduce((a, b) => a + b, 0) + l.tail.length * 12;
      expect(available - strip - 16).toBeGreaterThanOrEqual(330);
    }
  });

  it('picks the state from the room it has', () => {
    expect(spotlightLayout(390).state).toBe('stacked');
    expect(spotlightLayout(719).state).toBe('stacked');
    expect(spotlightLayout(720).state).toBe('caption');
    expect(spotlightLayout(999).state).toBe('caption');
    expect(spotlightLayout(1000).state).toBe('duo');
    expect(spotlightLayout(1279).state).toBe('duo');
    expect(spotlightLayout(1280).state).toBe('gallery');
    expect(spotlightLayout(1920).state).toBe('gallery');
  });

  it('keeps the 1440 gallery exactly as it was', () => {
    // The state everyone already likes: 280px card and the same taper the old
    // hardcoded ACCORDION_SCALES table produced.
    const l = spotlightLayout(1440);
    expect(l.cardWidth).toBe(280);
    expect(l.tail).toEqual([140, 100, 76, 54, 39, 28, 20]);
    expect(l.showGhostName).toBe(true);
    expect(l.detail).toBe('full');
  });

  it('keeps the scenery type to the gallery, where there is room for it', () => {
    // Type-as-scenery only works where there's negative space for it. The duo
    // deck fills its stage — strip plus panel — so a ghost name there would set
    // the character's name at display size twice within 40pt of itself.
    for (const w of WIDTHS) {
      const { state, showGhostName } = spotlightLayout(w);
      expect(showGhostName).toBe(state === 'gallery');
    }
  });

  it('sheds panel content in one fixed order', () => {
    const order = { full: 4, trim: 3, lean: 2, minimal: 1 } as const;
    let previous = order[spotlightLayout(2560).detail];
    for (let w = 2560; w >= 320; w -= 1) {
      const rank = order[spotlightLayout(w).detail];
      expect(rank).toBeLessThanOrEqual(previous);
      previous = rank;
    }
  });
});

// The panel's height comes from the card deck beside it, not from its own
// content, so surplus height cannot shrink the panel — it lands as a hole
// above the bottom-pinned pager. Measured on an iPad in portrait (a 509pt
// stage): 45pt of nothing under the first-appearance line while the summary
// was clamped to four. The summary is the only elastic thing in the panel, so
// the surplus is its to take — but the panel is `overflow: hidden`, so
// over-granting clips the pager off the bottom instead.
describe('summaryLineBudget', () => {
  // The measured stage on an iPad in portrait at 1032pt.
  const STAGE = spotlightLayout(1032).stageHeight;

  it('gives a one-line name more than the four it used to be fixed at', () => {
    expect(summaryLineBudget(STAGE, 1)).toBeGreaterThan(4);
  });

  it('takes lines back when the name wraps, rather than clipping the pager', () => {
    expect(summaryLineBudget(STAGE, 2)).toBeLessThan(summaryLineBudget(STAGE, 1));
  });

  // The budget's whole job: whatever it grants must still FIT. Reconstructing
  // the panel's height from the same parts the budget subtracts is what pins
  // that — a budget that overshoots by one line is invisible in a green suite
  // and clips the pager on a device.
  it.each([
    [1, 1],
    [2, 2],
  ])('fits inside the stage with a %d-line name', (nameLines) => {
    const used = 356 + (nameLines - 1) * 47 + summaryLineBudget(STAGE, nameLines) * 22 + 20;
    expect(used).toBeLessThanOrEqual(STAGE);
  });

  it('never drops below two lines, however short the stage', () => {
    expect(summaryLineBudget(300, 2)).toBe(2);
  });
});
