// src/lib/nativeMotion.ts — the native motion scale.
//
// `src/lib/motion.ts` is the WEB scale (CSS strings); native could never read
// it, so native grew ~25 distinct withTiming durations and 6 different spring
// configs — every screen inventing its own tempo. These are the canonical
// values: reach for one of these before typing a number.
//
// Reanimated only (no CSS), so this is safe to import from any native file.
import { Easing } from 'react-native-reanimated';

/** Durations in milliseconds. */
export const DUR = {
  /** Press/tap feedback, chips, toggles. */
  fast: 150,
  /** The default for most property transitions. */
  base: 220,
  /** Content arriving — screen and section entrances. */
  enter: 320,
  /** Content leaving. Exits run shorter than entrances so they feel decisive. */
  exit: 180,
  /** Deliberate, one-per-screen reveals (verdicts, boot). */
  feature: 620,
} as const;

/** Per-item delay for a staggered cascade, and the cap before items arrive together. */
export const STAGGER = { step: 90, cap: 3 } as const;

/** Decisive settle — fast out, gentle landing. The default curve. */
export const EASE_OUT = Easing.out(Easing.cubic);
/** Symmetric ease for loops and breathing (never for entrances). */
export const EASE_IN_OUT = Easing.inOut(Easing.ease);
/** The reveal curve — a longer, softer landing for feature moments. */
export const EASE_REVEAL = Easing.bezier(0.22, 1, 0.36, 1);

/** The one press-scale spring. Mirrors PressScale so nothing re-invents it. */
export const SPRING_PRESS = { damping: 18, stiffness: 250, mass: 0.6 } as const;
/** Softer spring for content settling into place (row cascades, sheets). */
export const SPRING_SETTLE = { damping: 18, stiffness: 160, mass: 1 } as const;

/** The shared skeleton shimmer half-cycle — one tempo app-wide. */
export const SHIMMER_MS = 850;
