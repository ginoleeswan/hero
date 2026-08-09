// src/design/elevation.ts — the shadow scale.
//
// WHY: 87 distinct `boxShadow` strings across the app, most of them one-offs
// differing by a pixel or two of blur. Shadow is a depth SIGNAL — if every card
// has its own, the signal carries no information and the page reads as noise.
//
// Four steps, because four is how many depths this app actually has: something
// resting on the surface, something lifted (a card), something floating (a
// pill, a FAB), and something overlaying everything (a sheet). If you find
// yourself wanting a fifth, the question is usually whether the element really
// needs a new depth or just a border.
//
// Values are the plurality shapes already in the codebase (0 6px 22px and
// 0 24px 60px were the two most common), rounded onto a consistent ramp.
//
// **Android needs `elevation`; `boxShadow` is a no-op there.** Each step
// carries both, so a consumer that spreads the token gets a shadow on both
// platforms — the single most common cause of "the card looks flat on Android".
import { Platform } from 'react-native';

type Step = { boxShadow: string; elevation: number };

const step = (y: number, blur: number, alpha: number, elevation: number): Step => ({
  boxShadow: `0 ${y}px ${blur}px rgba(41,60,67,${alpha})`,
  elevation,
});

export const ELEVATION = {
  /** Flat on the surface. Use a border, not a shadow, to separate. */
  none: { boxShadow: 'none', elevation: 0 } as Step,
  /** A card lifted off the sheet — rails, grid tiles. */
  sm: step(2, 8, 0.06, 2),
  /** The workhorse card depth. */
  md: step(6, 22, 0.08, 6),
  /** Floating chrome — pills, the compare CTA, FABs. */
  lg: step(12, 32, 0.12, 12),
  /** Sheets and modals over a scrim. */
  xl: step(24, 60, 0.18, 24),
} as const;

/**
 * iOS renders `boxShadow` and ignores `elevation`; Android does the reverse.
 * Spreading the token is normally enough — this helper exists for the few
 * places that need to strip one side (e.g. a view that already has an Android
 * background hack and would double up).
 */
export function elevationFor(step: keyof typeof ELEVATION) {
  const value = ELEVATION[step];
  return Platform.OS === 'android'
    ? { elevation: value.elevation }
    : { boxShadow: value.boxShadow };
}
