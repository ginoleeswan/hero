// The reading pill's two pure decisions, pinned. Both platforms compute them
// separately (UI-thread worklet on native, IntersectionObserver + scroll on
// web), so the RULES are what have to agree — not the implementations.
import { MIN_SECTIONS_FOR_CONTENTS } from '../../src/hooks/useBiography';

/**
 * Mirror of the native worklet's section pick. An unmeasured heading sits at
 * Infinity so it can never claim to be current — the bug this guards is every
 * section reading as "active" on open, when the offsets are all still 0.
 */
function activeSection(y: number, offsets: number[], readLine: number): number {
  let idx = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (y + readLine >= offsets[i]) idx = i;
  }
  return idx;
}

const READ_LINE = 220;

describe('activeSection', () => {
  const offsets = [300, 1200, 2400, 3600];

  it('starts on the first section before any heading is reached', () => {
    expect(activeSection(0, offsets, READ_LINE)).toBe(0);
  });

  it('advances once a heading crosses the read line, not when it appears', () => {
    // Heading 1 sits at 1200. At y=900 its top is 300px down the viewport —
    // visible, but not yet settled into the reading zone.
    expect(activeSection(900, offsets, READ_LINE)).toBe(0);
    expect(activeSection(1000, offsets, READ_LINE)).toBe(1);
  });

  it('holds the last section at the bottom of the document', () => {
    expect(activeSection(9999, offsets, READ_LINE)).toBe(3);
  });

  it('never lets an unmeasured heading claim to be current', () => {
    // Sections 2 and 3 have not been measured yet (images still loading above).
    const partial = [300, 1200, Infinity, Infinity];
    expect(activeSection(5000, partial, READ_LINE)).toBe(1);
  });

  it('treats an all-unmeasured document as section one', () => {
    expect(activeSection(4000, [Infinity, Infinity, Infinity], READ_LINE)).toBe(0);
  });
});

describe('MIN_SECTIONS_FOR_CONTENTS', () => {
  it('is the same threshold both screens gate on', () => {
    // Native reserves scroll padding for the pill and web decides whether to
    // mount the observer using this constant; if they drifted apart, one
    // platform would reserve space for a pill that never renders.
    expect(MIN_SECTIONS_FOR_CONTENTS).toBe(3);
  });
});
