// src/design/index.ts — the one import for the design system.
//
// Everything a screen needs to look like Mythique comes from here:
//
//   import { COLORS, RADIUS, SPACE, DISPLAY, LABEL, ELEVATION } from '../design';
//
// The system is two layers, and the distinction matters:
//
//   PRIMITIVES  the raw scales — RADIUS, SPACE, TRACKING, DISPLAY/BODY/LABEL,
//               ELEVATION, the COLORS palette. Values with no opinion about
//               where they are used.
//   SEMANTIC    what a value MEANS on a given canvas — SURFACE, PAPER_TEXT,
//               INK_TEXT, ACCENT_INK, EYEBROW. These encode the app's two
//               canvases (beige paper, deep ink) and the measured contrast
//               ratios that keep text legible on each.
//
// **Reach for semantic first.** `PAPER_TEXT.muted` says "secondary text on the
// beige canvas" and is guaranteed 5.61:1; `COLORS.navy` at 60% opacity says
// nothing and happens to be 3.33:1, which fails WCAG. The palette is for
// building new semantic roles, not for use at the call site.
//
// This barrel is platform-neutral data with no React Native imports beyond
// `Platform` (in elevation), so web and `api/` can consume it too — the system
// is one system, not a native one with a web copy.
//
// Enforcement: `yarn check:ui` ratchets the number of off-scale radius and
// font-size literals. It cannot go up. See docs/architecture/design-system.md.

// ── primitives ──────────────────────────────────────────────────────────────
export { RADIUS, SPACE, SCREEN_PAD, TRACKING, SEAM } from '../constants/tokens';
export { DISPLAY, BODY, LABEL, EYEBROW_TYPE, TYPE } from './type';
export { ELEVATION, elevationFor } from './elevation';
export { COLORS } from '../constants/colors';

// ── semantic ────────────────────────────────────────────────────────────────
export {
  SURFACE,
  SEAM_COLOR,
  SURFACE_GRADIENT,
  PAPER_TEXT,
  INK_TEXT,
  ACCENT_INK,
  ORANGE_INK,
  GOLD_INK,
  HOUSE_INK,
  EYEBROW,
  EYEBROW_ON_PAPER,
  SHARE_CARD,
} from '../constants/colors';

// ── motion ──────────────────────────────────────────────────────────────────
// Durations, easings and springs live with the native motion vocabulary; they
// are re-exported here so "the design system" is one import rather than two.
export { DUR, STAGGER, SPRING_SETTLE } from '../lib/nativeMotion';
