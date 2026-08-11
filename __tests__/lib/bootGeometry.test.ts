import {
  centringPull,
  curtainOpacity,
  eyeCentre,
  markGrow,
  revealRamp,
  EYE_H,
  GROW_AT,
  MARK_REST,
  RECOIL,
  UNIT,
} from '../../src/lib/bootGeometry';
import { LOGO_EYE_LEFT, LOGO_INK, SPLASH_LOCKUP } from '../../src/constants/logo';

// Real portrait point sizes: SE, 13 mini, 14, 15 Pro Max, and an iPad — the
// reveal derives its scale ramp from screen height, so the ends of that range
// are where it would break first.
const SCREENS = [
  { w: 375, h: 667 },
  { w: 375, h: 812 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 820, h: 1180 },
  { w: 1024, h: 1366 },
];

/** Where the mark's left eye actually is once the centring pull is applied. */
function eyeAt(p: number, screen: { w: number; h: number }) {
  const ramp = revealRamp(screen.h);
  const scale = MARK_REST * markGrow(p, ramp);
  const natural = eyeCentre(
    scale,
    screen.w,
    (screen.h - SPLASH_LOCKUP.h) / 2 + SPLASH_LOCKUP.markCY,
  );
  const pull = centringPull(p);
  return {
    scale,
    x: natural.x + pull * (screen.w / 2 - natural.x),
    y: natural.y + pull * (screen.h / 2 - natural.y),
  };
}

describe('boot reveal geometry', () => {
  it('renders the mark at the lockup width the splash PNG was drawn at', () => {
    // If this drifts, the JS stage and the native splash show different marks
    // and the handoff becomes a visible jump.
    expect(LOGO_INK.w * UNIT * MARK_REST).toBeCloseTo(SPLASH_LOCKUP.markW, 6);
  });

  it('recoils once, then grows monotonically to the ramp maximum', () => {
    for (const screen of SCREENS) {
      const ramp = revealRamp(screen.h);
      expect(markGrow(0, ramp)).toBe(1);
      expect(markGrow(GROW_AT[1], ramp)).toBeCloseTo(RECOIL, 6);
      expect(markGrow(1, ramp)).toBeCloseTo(ramp.max, 6);
      // The anticipation dip is the ONLY non-monotonic stretch: shrinking
      // during the recoil window, never below RECOIL, and strictly growing
      // from the moment the lunge starts.
      let prev = 1;
      for (let p = 0; p <= GROW_AT[1] + 1e-9; p += 0.005) {
        const g = markGrow(p, ramp);
        expect(g).toBeLessThanOrEqual(prev + 1e-9);
        expect(g).toBeGreaterThanOrEqual(RECOIL - 1e-9);
        prev = g;
      }
      for (let p = GROW_AT[1]; p <= 1.0001; p += 0.005) {
        const g = markGrow(p, ramp);
        expect(g).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = g;
      }
    }
  });

  // THE rule. The app is supposed to arrive through the mask's eye; if the
  // curtain fades while the mark is still smaller than the display, it arrives
  // around the mark's outer edge instead — on whichever device the margin
  // happens to fail on, which is exactly the bug a hand-tuned constant hides.
  //
  // Walking eased progress directly is sufficient coverage: the exit timing is
  // monotonic 0→1, so every state it can reach appears in this sweep.
  it('never drops the curtain before the ink covers the screen', () => {
    const above = LOGO_EYE_LEFT.cy - LOGO_INK.y;
    const below = LOGO_INK.y + LOGO_INK.h - LOGO_EYE_LEFT.cy;
    const left = LOGO_EYE_LEFT.cx - LOGO_INK.x;
    const right = LOGO_INK.x + LOGO_INK.w - LOGO_EYE_LEFT.cx;

    for (const screen of SCREENS) {
      const ramp = revealRamp(screen.h);
      for (let p = 0; p <= 1.0001; p += 0.005) {
        if (curtainOpacity(markGrow(p, ramp), ramp) === 1) continue;
        const eye = eyeAt(p, screen);
        const k = UNIT * eye.scale;
        expect(eye.y - above * k).toBeLessThanOrEqual(0);
        expect(eye.y + below * k).toBeGreaterThanOrEqual(screen.h);
        expect(eye.x - left * k).toBeLessThanOrEqual(0);
        expect(eye.x + right * k).toBeGreaterThanOrEqual(screen.w);
      }
    }
  });

  it('opens the eye wider than the screen by the end', () => {
    for (const screen of SCREENS) {
      const eye = eyeAt(1, screen);
      const h = LOGO_EYE_LEFT.h * UNIT * eye.scale;
      const w = LOGO_EYE_LEFT.w * UNIT * eye.scale;
      expect(h).toBeGreaterThanOrEqual(screen.h);
      expect(w).toBeGreaterThanOrEqual(screen.w);
      expect(eye.x).toBeCloseTo(screen.w / 2, 6);
      expect(eye.y).toBeCloseTo(screen.h / 2, 6);
    }
  });

  it('holds the curtain fully opaque until the mark starts moving', () => {
    for (const screen of SCREENS) {
      const ramp = revealRamp(screen.h);
      expect(curtainOpacity(markGrow(0, ramp), ramp)).toBe(1);
      expect(curtainOpacity(markGrow(1, ramp), ramp)).toBe(0);
      expect(ramp.max).toBeGreaterThan(ramp.cover);
    }
  });

  it('scales the eye from a hole in the resting mark', () => {
    // Sanity that EYE_H is the rest-size eye, not a viewBox unit that happens
    // to be in range: the eye is a little under a fifth of the mark's width.
    expect(EYE_H).toBeCloseTo((LOGO_EYE_LEFT.h / LOGO_INK.w) * SPLASH_LOCKUP.markW, 6);
  });

  it('finishes centring the eye before the curtain is allowed to move', () => {
    // The ordering these two rules depend on. `cover` only budgets half a
    // screen of ink because the eye is already at the centre when it applies;
    // if the curtain could start fading while the pull was still running, that
    // budget would be wrong and the app would show past the mark's rim.
    for (const screen of SCREENS) {
      const ramp = revealRamp(screen.h);
      for (let p = 0; p <= 1.0001; p += 0.005) {
        if (curtainOpacity(markGrow(p, ramp), ramp) < 1) expect(centringPull(p)).toBe(1);
      }
    }
  });
});
