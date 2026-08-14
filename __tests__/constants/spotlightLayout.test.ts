import { spotlightLayout } from '../../src/constants/spotlightLayout';

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

  it('drops the scenery type and the deck together', () => {
    // Type-as-scenery only works where there's negative space for it.
    for (const w of WIDTHS) {
      const { tail, showGhostName } = spotlightLayout(w);
      expect(showGhostName).toBe(tail.length > 0);
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
