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
    // Where the eye hole alone is taller than the display — the mask is past
    // your head and there is nothing on screen but app — plus a little, so the
    // rim is unambiguously gone rather than kissing the edge.
    //
    // Deliberately NOT further. Everything beyond this point is off screen, so
    // it is motion nobody can see, bought with magnification everybody can:
    // react-native-svg rasterises at layout size, so every extra multiple is
    // spent softening the rim during the one stretch where the rim is the
    // subject. An earlier pass ran to 1.5x the swallow point and simply threw
    // a third of the reveal's running time into the void.
    max: (screenH / EYE_H) * 1.12,
  };
}

// How far back the mask draws before it lunges. Anticipation is what separates
// a lunge from a zoom — everything that moves like it has a body loads up
// before it strikes. It happens while the wordmark is leaving, so act one of
// the exit is "the screen draws breath" and act two is the strike; the mask
// never grows while the wordmark is still on screen, because two things moving
// at once read as a scramble rather than a handover.
export const RECOIL = 0.955;

/** Progress at which the recoil bottoms out and the lunge begins. */
export const LUNGE_AT = 0.22;
/**
 * Progress at which the ink covers the display — the breakthrough. The curtain
 * may begin to drop here and not before, and it is where the haptic fires.
 */
export const SEAT_AT = 0.72;

/**
 * The mask's scale multiplier at exit progress `p`, in three continuous acts.
 *
 * This was piecewise-LINEAR between hand-placed anchors, which is wrong twice
 * over. Linear scale is not linear approach — an object coming at you at a
 * constant speed grows EXPONENTIALLY, because scale goes as 1/distance — so a
 * linear ramp reads as something being inflated rather than something coming
 * closer. And every anchor was a corner: constant velocity, then a different
 * constant velocity, which the eye reads as a stutter at each joint.
 *
 *   0 → LUNGE_AT   the draw-back, easing to a stop at RECOIL
 *   LUNGE_AT → SEAT_AT   exponential: constant approach speed, no corners
 *   SEAT_AT → 1    decelerating to `max` — the mask ARRIVES and seats over
 *                  your face rather than blasting past at full tilt. This is
 *                  also the only act you watch through the eye, so it gets a
 *                  quarter of the running time instead of a handful of frames.
 */
export function markGrow(p: number, ramp: { cover: number; max: number }): number {
  'worklet';
  if (p <= 0) return 1;
  if (p >= 1) return ramp.max;
  if (p <= LUNGE_AT) {
    // Ease out into the loaded position: the draw-back settles, it does not
    // stop dead and leave a corner where the lunge begins.
    const v = p / LUNGE_AT;
    return 1 - (1 - RECOIL) * (1 - (1 - v) * (1 - v));
  }
  if (p <= SEAT_AT) {
    const u = (p - LUNGE_AT) / (SEAT_AT - LUNGE_AT);
    return RECOIL * Math.pow(ramp.cover / RECOIL, u);
  }
  const v = (p - SEAT_AT) / (1 - SEAT_AT);
  return ramp.cover + (ramp.max - ramp.cover) * (1 - (1 - v) * (1 - v));
}

/** Progress by which the eye is fully centred — before the curtain may move. */
export const PULL_DONE = 0.6;

/**
 * How far the eye has been drawn toward the centre of the screen. It finishes
 * well before the curtain drops, so the reveal opens symmetrically instead of
 * sliding the last of the mark's rim off one corner. Eased so it arrives at
 * the centre rather than sliding at a constant rate and then stopping dead —
 * a hard stop in a translation is as visible as a hard stop in a scale.
 */
export function centringPull(p: number): number {
  'worklet';
  if (p >= PULL_DONE) return 1;
  const v = p / PULL_DONE;
  return 1 - (1 - v) * (1 - v);
}

/**
 * The curtain's opacity. Keyed to the mark's SCALE and not to elapsed time,
 * because the rule it enforces is about how much of the screen the ink covers.
 */
export function curtainOpacity(grow: number, ramp: { cover: number }): number {
  'worklet';
  // Coverage is where the curtain MAY start to go; this is how long it takes.
  // Scale moves fast here, so the multiplier has to be generous to buy the
  // drop enough frames to read as breaking through rather than as a dropped
  // frame. At 1.25x it was gone in about three.
  const end = ramp.cover * 1.6;
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
