// src/lib/bootGeometry.ts — the maths behind the boot reveal.
//
// Extracted from BootStage so the one rule the reveal MUST obey can be tested
// rather than asserted in a comment:
//
//   the navy curtain may not start to fade until the mark's ink covers the
//   whole display from wherever the eye currently is.
//
// Break that and the app does not arrive through the mask's eye — it leaks in
// around the mark's outer edge, on whichever device the margin happens to fail
// on. It is a statement about geometry and screen height, so it is checked
// against real screen heights in __tests__/lib/bootGeometry.test.ts.
//
// Every function is a worklet: BootStage calls them from useAnimatedStyle on
// the UI thread, and the tests call them as ordinary JavaScript.
import { LOGO_EYE_LEFT, LOGO_INK, SPLASH_LOCKUP } from '../constants/logo';

/** Layout size of the mark's SVG box, in points. */
export const MARK_SVG = 512;
/** Points per viewBox unit at transform scale 1. */
export const UNIT = MARK_SVG / 1024;
/** Transform scale that renders the mark's ink at the lockup's width. */
export const MARK_REST = SPLASH_LOCKUP.markW / (LOGO_INK.w * UNIT);

export const INK_CX = LOGO_INK.x + LOGO_INK.w / 2;
export const INK_CY = LOGO_INK.y + LOGO_INK.h / 2;

/**
 * Distance in points, at rest, from the eye's centre to the ink's top edge —
 * the SHORTER of the eye's two vertical margins, so covering this covers both.
 */
export const INK_ABOVE_EYE = (LOGO_EYE_LEFT.cy - LOGO_INK.y) * UNIT * MARK_REST;
/** The eye hole's height in points at rest. */
export const EYE_H = LOGO_EYE_LEFT.h * UNIT * MARK_REST;

/**
 * The reveal's shape, as multiples of the rest scale. Both ends are derived
 * from the device rather than picked: a number that works on a 6.7" phone is
 * not big enough on an iPad and is needlessly far on an SE.
 */
export function revealRamp(screenH: number) {
  'worklet';
  return {
    // Where the ink reaches every edge of the display, so the curtain can drop.
    // Measured to 0.55 of the screen height rather than 0.5 for margin only:
    // PULL_DONE guarantees the eye is already centred by the time the curtain
    // is allowed to move, so half the screen is genuinely the distance to
    // cover. (It was 0.68 while the centring still lagged — the ink then had
    // to reach the far edge from wherever the eye had got to, which cost real
    // magnification and therefore real sharpness.)
    cover: (0.55 * screenH) / INK_ABOVE_EYE,
    // Where the eye hole alone is taller than the display: past this there is
    // nothing on screen but app.
    max: (screenH / EYE_H) * 1.02,
  };
}

// Progress breakpoints of the scale ramp. The mark holds still through the
// first stretch: the wordmark is leaving then, and two things moving at once
// read as a scramble rather than a handover.
export const GROW_AT = [0, 0.18, 0.45, 0.62, 1] as const;

/** The mark's scale multiplier at eased exit progress `p`. */
export function markGrow(p: number, ramp: { cover: number; max: number }): number {
  'worklet';
  const to = [1, 1, 3.2, ramp.cover, ramp.max];
  const last = to.length - 1;
  if (p <= 0) return to[0];
  if (p >= 1) return to[last];
  for (let i = 1; i < GROW_AT.length; i++) {
    if (p <= GROW_AT[i]) {
      const span = GROW_AT[i] - GROW_AT[i - 1];
      const t = span === 0 ? 0 : (p - GROW_AT[i - 1]) / span;
      return to[i - 1] + (to[i] - to[i - 1]) * t;
    }
  }
  return to[last];
}

/** Progress by which the eye is fully centred — before the curtain may move. */
export const PULL_DONE = 0.6;

/**
 * How far the eye has been drawn toward the centre of the screen. It finishes
 * well before the curtain drops, so the reveal opens symmetrically instead of
 * sliding the last of the mark's rim off one corner.
 */
export function centringPull(p: number): number {
  'worklet';
  return p >= PULL_DONE ? 1 : p / PULL_DONE;
}

/**
 * The curtain's opacity. Keyed to the mark's SCALE and not to elapsed time,
 * because the rule it enforces is about how much of the screen the ink covers.
 */
export function curtainOpacity(grow: number, ramp: { cover: number }): number {
  'worklet';
  // A quarter again past coverage rather than a hair past it: at the exit's
  // pace the tighter window was a ~40ms cut, which reads as a dropped frame
  // rather than as breaking through.
  const end = ramp.cover * 1.25;
  if (grow <= ramp.cover) return 1;
  if (grow >= end) return 0;
  return 1 - (grow - ramp.cover) / (end - ramp.cover);
}

/**
 * Where the mark's left eye sits, in screen points, at transform `scale` and
 * before the centring pull is applied. `markCY` is the ink centre's resting y.
 */
export function eyeCentre(scale: number, screenW: number, markCY: number) {
  'worklet';
  return {
    x: screenW / 2 - (INK_CX - 512) * UNIT * MARK_REST + (LOGO_EYE_LEFT.cx - 512) * UNIT * scale,
    y: markCY - (INK_CY - 512) * UNIT * MARK_REST + (LOGO_EYE_LEFT.cy - 512) * UNIT * scale,
  };
}
