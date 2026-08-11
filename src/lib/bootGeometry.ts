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

export const INK_CX = LOGO_INK.x + LOGO_INK.w / 2;
export const INK_CY = LOGO_INK.y + LOGO_INK.h / 2;

/**
 * The SVG viewBox for the mark: the INK's own bounds, not the 1024 artboard.
 *
 * The box used to be a 1024-viewBox square laid out at 512pt. Three things
 * were wrong with that, and they compound:
 *
 *   • the ink is 24% of that square's area, so three quarters of the raster
 *     was empty and the mask got a fraction of the resolution it paid for;
 *   • a 512pt box centred on a 160pt mark has to hang off BOTH screen edges
 *     (left = -59.5 on a 393pt screen), which is a layout begging to be
 *     clamped by anything in the parent chain;
 *   • and every position had to carry a correction for where the ink sits
 *     inside the artboard, which is arithmetic that can silently disagree
 *     with what the layout engine actually did.
 *
 * Cropping the viewBox to the ink makes the box's centre the ink's centre and
 * the box's edges the ink's edges. The maths below stops needing to know
 * anything about artboards, and the box is small enough to sit fully on screen
 * with positive offsets on every device — so there is nothing left to clamp.
 */
export const MARK_VIEWBOX = `${LOGO_INK.x} ${LOGO_INK.y} ${LOGO_INK.w} ${LOGO_INK.h}`;
export const INK_ASPECT = LOGO_INK.w / LOGO_INK.h;

/** Horizontal breathing room kept between the mark's box and the screen edge. */
const BOX_INSET = 24;

/**
 * The mark's SVG box in points — as large as will comfortably fit, because its
 * size is the resolution the reveal magnifies from, and no larger, because a
 * box wider than its parent is the bug this replaced.
 */
export function markBox(screenW: number) {
  'worklet';
  const w = screenW - BOX_INSET;
  return { w, h: w / INK_ASPECT };
}

/** Transform scale that renders the ink at the lockup's width, for this box. */
export function markRest(boxW: number) {
  'worklet';
  return SPLASH_LOCKUP.markW / boxW;
}

/**
 * Points per viewBox unit AT REST. Because the box is cropped to the ink, this
 * depends only on the lockup — not on the box, the screen or the artboard — so
 * the geometry below is device-independent and `grow` alone scales it.
 */
export const INK_PT = SPLASH_LOCKUP.markW / LOGO_INK.w;

/**
 * Distance in points, at rest, from the eye's centre to the ink's top edge —
 * the SHORTER of the eye's two vertical margins, so covering this covers both.
 */
export const INK_ABOVE_EYE = (LOGO_EYE_LEFT.cy - LOGO_INK.y) * INK_PT;
/** The eye hole's height in points at rest. */
export const EYE_H = LOGO_EYE_LEFT.h * INK_PT;

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
export const RECOIL = 0.94;

/** Progress at which the recoil bottoms out and the lunge begins. */
export const LUNGE_AT = 0.2;

/**
 * The lunge's shape. 1 is a constant approach speed (pure exponential); above
 * 1 the mask accelerates the whole way in, which is what a thrown object does
 * and what makes the strike feel like a strike rather than a dolly move. Held
 * modest — past about 1.4 the first half of the lunge stops moving enough to
 * hold attention and the whole thing collapses into a late whip.
 */
export const LUNGE_BITE = 1.25;
/**
 * Progress at which the ink covers the display — the breakthrough. The curtain
 * may begin to drop here and not before, and it is where the haptic fires.
 *
 * It also splits the running time, and the split is a design decision rather
 * than a number: everything before it is the approach, everything after it is
 * the only part the audience came for — the app arriving through the eye. At
 * 0.72 the approach ran 728ms and the payoff got 248ms, which is the wrong way
 * round. The reveal should not be the shortest act in its own sequence.
 */
export const SEAT_AT = 0.62;

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
    // Smoothstep: leaves rest and arrives at the loaded position with zero
    // velocity at both ends. The mask must not appear to be shoved backwards
    // (a hard start) and must be visibly HELD at the bottom for an instant —
    // the held beat is the anticipation; without it a draw-back is just a
    // wobble.
    const v = p / LUNGE_AT;
    return 1 - (1 - RECOIL) * (v * v * (3 - 2 * v));
  }
  if (p <= SEAT_AT) {
    // Pure exponential, entered at full speed. The velocity discontinuity at
    // LUNGE_AT is the point: the recoil ends at rest and the lunge begins at
    // speed, which is what a strike is. Smoothing it would ease the mask out
    // of the loaded position and throw away the anticipation that was just
    // paid for.
    //
    // Exponential is also the physically honest curve — an object approaching
    // at constant velocity grows at a constant RELATIVE rate, so this reads as
    // approach while its absolute growth still accelerates.
    const u = (p - LUNGE_AT) / (SEAT_AT - LUNGE_AT);
    return RECOIL * Math.pow(ramp.cover / RECOIL, Math.pow(u, LUNGE_BITE));
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
 * Where the mark's left eye sits, in screen points, at scale multiple `grow`
 * and before the centring pull is applied. `markCY` is the ink centre's
 * resting y — and because the box is cropped to the ink, the ink's centre IS
 * the box's centre, which is the origin the transform scales about. So the eye
 * is simply its offset from that centre, grown.
 */
export function eyeCentre(grow: number, screenW: number, markCY: number) {
  'worklet';
  return {
    x: screenW / 2 + (LOGO_EYE_LEFT.cx - INK_CX) * INK_PT * grow,
    y: markCY + (LOGO_EYE_LEFT.cy - INK_CY) * INK_PT * grow,
  };
}

// ── No tilt ────────────────────────────────────────────────────────────────
//
// There was a markTilt() here, twice. A perspective transform on the mask's
// view CLIPS IT on device, and that is now established rather than suspected:
// removed alongside the viewBox crop and the clipping stopped; restored on its
// own and it came straight back; the build after that touched no geometry and
// it stayed.
//
// The arithmetic said it was safe every time — bounded keystone, near edge at
// 16% of the camera distance, level before any large scale — and it clipped
// regardless. iOS rasterises a 3D-transformed layer differently, and a view
// magnified 30x afterwards is exactly where that bites. Reasoning was not the
// missing ingredient; a device was.
//
// If the depth cue is wanted back it must come from a 2D affine approximation
// — a skew plus an axis-differential scale — which cannot change how the layer
// is rasterised. A smaller angle is not a fix.

// ── Squash and stretch ─────────────────────────────────────────────────────
//
// What the mask gets INSTEAD of a tilt, and it is not a consolation prize.
//
// A rotation reads as a turn because of the keystone — the far edge shrinking.
// An affine transform cannot produce one, so a 2D "turn" is only
// scaleX x cos(theta): a horizontal squash wearing a rotation's name. An actual
// skew on a symmetrical mask reads as italic, which looks like a rendering
// fault rather than depth. Neither is worth having.
//
// Squash and stretch is. The mask compresses as it loads and elongates as it
// strikes — the oldest principle in character animation, and it reads as weight
// rather than as a trick. Plain scaleX/scaleY, which cannot change how the
// layer is rasterised.
//
// It resolves to uniform by SQUASH_DONE, well before SEAT_AT, so every frame
// the coverage rule applies to is uniformly scaled and the flat-geometry maths
// stays honest. Same discipline the tilt was held to; this one can keep it,
// because it is not asking the renderer for anything unusual.
export const SQUASH_DONE = 0.45;
/** Peak compression on the load, as a fraction. 4% is weight; 10% is cartoon. */
const LOAD = 0.035;
/** Peak elongation on the strike. Slightly under the load — it recovers. */
const THROW = 0.03;
/** How far past LUNGE_AT the stretch peaks. */
const THROW_AT = 0.1;

/**
 * Per-axis scale multipliers at exit progress `p`. Both are 1 at rest and 1
 * again from SQUASH_DONE onward, so the mask is only ever non-uniform while it
 * is loading and launching.
 */
export function markSquash(p: number): { x: number; y: number } {
  'worklet';
  const ss = (from: number, to: number, a: number, b: number) => {
    const v = (p - a) / (b - a);
    return from + (to - from) * (v * v * (3 - 2 * v));
  };
  if (p <= 0 || p >= SQUASH_DONE) return { x: 1, y: 1 };
  if (p <= LUNGE_AT) {
    // Loading: wider and shorter, the way anything settles under its own weight
    // before it moves.
    return { x: ss(1, 1 + LOAD, 0, LUNGE_AT), y: ss(1, 1 - LOAD, 0, LUNGE_AT) };
  }
  const peak = LUNGE_AT + THROW_AT;
  if (p <= peak) {
    // Launching: it snaps through uniform and out the other side, narrower and
    // taller, elongated along the direction it is travelling.
    return {
      x: ss(1 + LOAD, 1 - THROW, LUNGE_AT, peak),
      y: ss(1 - LOAD, 1 + THROW, LUNGE_AT, peak),
    };
  }
  return { x: ss(1 - THROW, 1, peak, SQUASH_DONE), y: ss(1 + THROW, 1, peak, SQUASH_DONE) };
}
