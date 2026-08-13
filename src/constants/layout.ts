// src/constants/layout.ts — how the app sizes itself, as pure functions of the
// window's width.
//
// THE MISTAKE THIS FILE EXISTS TO UNDO. Twenty-six modules read
// `Dimensions.get('window')` at module scope and derived their sizes from it as
// a PROPORTION: a rail card is 60% of the screen, the spotlight is half its
// height, a grid is three columns wide. Both halves of that are right on a
// phone and wrong on an iPad.
//
//   • Module scope is a snapshot. A phone's width never changes, so reading it
//     once at import is free. An iPad's changes constantly — rotation, Split
//     View, Slide Over, Stage Manager — and a value captured at launch is
//     simply wrong for the rest of the session.
//   • A proportion is not a size. 60% of a 390pt phone is a 234pt card, which
//     is a comfortable thing to flick through. 60% of a 1024pt iPad is a 614pt
//     card: one and a half of them fit, and the rail stops reading as a rail
//     and starts reading as a broken carousel.
//
// So the rule for the tablet is **the same physical card, more of them** — not
// a bigger card. A reader holding an iPad is not holding a magnifying glass.
//
// Everything here is a pure function of width so a screen and its skeleton can
// both call it with the same live number and land in the same place, which is
// the invariant the *Geometry files already exist to protect.

/** Named widths, not device names — Split View makes "is an iPad" meaningless. */
export type Breakpoint = 'phone' | 'tablet' | 'wide';

/**
 * The two thresholds.
 *
 * 700 sits above every phone in landscape and below the narrowest iPad in
 * portrait (the mini, at 744). 1024 is an iPad in landscape, where a second
 * column of content genuinely fits.
 *
 * Deliberately keyed on the WINDOW and not the screen: an app in a third of an
 * iPad's width is 320pt wide and should look exactly like a phone, because from
 * the reader's side it is one. Asking "is this an iPad" instead would dress a
 * 320pt column in a tablet layout.
 */
export const BREAKPOINTS = { tablet: 700, wide: 1024 } as const;

export function breakpointFor(width: number): Breakpoint {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

export const isTabletWidth = (width: number): boolean => width >= BREAKPOINTS.tablet;

/**
 * The page gutter. Wider on a tablet because a 15pt margin on a 1024pt page
 * reads as text that has been pushed against the bezel.
 */
export function pagePadding(width: number): number {
  const bp = breakpointFor(width);
  return bp === 'wide' ? 32 : bp === 'tablet' ? 24 : 15;
}

/**
 * The widest a column of content is allowed to get, centred in whatever is
 * left. Beyond about 900pt a single column stops being a column and becomes a
 * line of text you have to move your head to read — the same reason the web
 * layout caps its measure.
 */
export const CONTENT_MAX_WIDTH = 900;

/** How much of `width` a centred content column actually occupies. */
export function contentWidth(width: number): number {
  return Math.min(width - pagePadding(width) * 2, CONTENT_MAX_WIDTH);
}

/**
 * Columns for a poster grid, from a target card width rather than a device.
 *
 * Expressed this way the grid gains columns smoothly as the window grows —
 * including through the intermediate widths a Split View drag passes through,
 * which a breakpoint table would step across in visible jumps.
 */
export function gridColumns(width: number, target = 120, min = 3, max = 8): number {
  const usable = Math.min(width, CONTENT_MAX_WIDTH + pagePadding(width) * 2);
  return Math.max(min, Math.min(max, Math.round(usable / target)));
}

/**
 * A horizontal rail's card width.
 *
 * On a phone this stays exactly what it was — 60% of the window — because that
 * is a tuned number and the phone layout is not what we are fixing. Above the
 * tablet threshold it becomes a fixed size instead, so the rail shows more
 * cards rather than larger ones.
 */
export function railCardWidth(width: number, phoneRatio = 0.6, tabletWidth = 260): number {
  return isTabletWidth(width) ? tabletWidth : Math.round(width * phoneRatio);
}

/**
 * The billboard's height.
 *
 * Half the window height is right in portrait and far too tall in landscape,
 * where it would leave nothing else on screen. Capped against the width too, so
 * the hero image keeps a sane aspect instead of becoming a letterbox.
 */
export function spotlightHeightFor(width: number, height: number, insetTop = 0): number {
  const half = height * 0.5;
  const capped = isTabletWidth(width) ? Math.min(half, width * 0.62) : half;
  return Math.round(capped + insetTop);
}
