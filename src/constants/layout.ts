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

/**
 * iPadOS floats the tab bar at the TOP of the screen, not the bottom, so a
 * tablet screen has to pad for it the way a phone screen pads for a bottom
 * bar. Measured on an iPad Pro 13" in both orientations: the pill (Explore /
 * Arena / Profile / search) spans roughly 19-71pt, sitting directly on top of
 * whatever the screen draws first. A ~24pt safe-area inset plus this clears it.
 *
 * Lives here rather than in SpotlightDeck, where it started, because it is not
 * the billboard's number — it is every tablet screen's number, and the Arena
 * proved it by shipping without it: `topInset + 24` put "Today's Debate" at
 * 52pt, behind a pill that ends at 71.
 */
export const TABLET_TAB_CLEARANCE = 48;

/**
 * What a scrolling screen must reserve at its BOTTOM so its last row is not
 * parked under the floating tab bar.
 *
 * iOS 26 floats the bar over the content rather than insetting it, so every
 * scroll view has to pad for it itself. Four screens had four different ideas
 * of how much: Explore reserved `insets.bottom + 96`, the Arena `+ 40`,
 * Search `+ 72`, and Profile a flat `100` that ignored the safe-area inset
 * altogether — so on a device with a home indicator its last card sat under
 * the glass. The bar is ~64pt of pill plus its own margin; 96 clears it with
 * room to read the row underneath rather than merely uncovering it.
 *
 * Always ADD the safe-area inset: this is the bar's height, not the device's.
 */
export const TAB_BAR_CLEARANCE = 96;

/** The top padding a tablet screen needs before it can draw anything, given
 *  its own safe-area inset. A no-op below the tablet threshold — a phone's tab
 *  bar is at the bottom, so there is nothing up there to clear. */
export function tabTopClearance(width: number, insetTop: number): number {
  return insetTop + (isTabletWidth(width) ? TABLET_TAB_CLEARANCE : 0);
}

export function breakpointFor(width: number): Breakpoint {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

export const isTabletWidth = (width: number): boolean => width >= BREAKPOINTS.tablet;

/**
 * A tablet's SHAPE, which the width alone cannot tell you — and on a screen
 * built around one big portrait, the shape is the thing that decides the
 * layout.
 *
 * An iPad Pro 13" is 1032×1376 in portrait and 1376×1032 in landscape. Both are
 * `wide` by `breakpointFor`, so a width-keyed layout gives them the same
 * treatment — and they are opposite shapes. The character page is where that
 * bites hardest: its hero is `width × aspect`, and because `heroImageAspect`
 * floors at 1.1, landscape asks for a **1514pt-tall** image inside a 1032pt
 * viewport. One and a half screens of portrait before a word of content.
 *
 * - `tall` — stack. Art above, content below, the same structure as a phone.
 * - `wide` — split. Art holds one column at full height, content scrolls beside
 *   it. A column is itself a portrait, so the Apple Zoom target keeps a
 *   portrait aspect and the morph still lands.
 *
 * The `wide` case is gated on `BREAKPOINTS.wide`, not on `tablet`, so a phone
 * in landscape can never reach it: the widest is ~956pt and every iPad in
 * landscape is at least 1133pt (mini). Keying on `isTabletWidth` instead would
 * hand an 844×390 window a two-column layout 390pt tall.
 */
export type TabletShape = 'none' | 'tall' | 'wide';

export function tabletShape(width: number, height: number): TabletShape {
  if (width >= BREAKPOINTS.wide && width > height) return 'wide';
  return isTabletWidth(width) ? 'tall' : 'none';
}

/**
 * The page gutter. Wider on a tablet because a 15pt margin on a 1024pt page
 * reads as text that has been pushed against the bezel.
 */
export function pagePadding(width: number): number {
  const bp = breakpointFor(width);
  return bp === 'wide' ? 32 : bp === 'tablet' ? 24 : 15;
}

/**
 * A feed section's horizontal inset, preserving whatever the phone already uses.
 *
 * `pagePadding` is the app-wide gutter and its phone value is 15. Explore's
 * sections were tuned at 16, and a one-point shift on every heading is exactly
 * the phone-visible diff the tablet work is not allowed to make — so the phone
 * value is a parameter and only the tablet widths are unified. Pass the
 * caller's existing literal and the phone cannot move.
 */
export function sectionGutter(width: number, phone = 16): number {
  const bp = breakpointFor(width);
  return bp === 'wide' ? 32 : bp === 'tablet' ? 24 : phone;
}

/**
 * The widest a column of content is allowed to get, centred in whatever is
 * left. Beyond about 900pt a single column stops being a column and becomes a
 * line of text you have to move your head to read — the same reason the web
 * layout caps its measure.
 */
export const CONTENT_MAX_WIDTH = 900;

/**
 * The widest a line of body copy may run, independent of the column it sits in.
 *
 * A section head keeps its left edge on the page gutter so every row in the
 * feed shares one edge — the raggedness Arena had came from centring some
 * sections and not others. But a standfirst inheriting that full width becomes
 * an unreadable measure at 1312pt, so the CAP GOES ON THE TEXT, not on the
 * block: aligned left, wrapped at a sane measure, no centring anywhere.
 */
export const PROSE_MAX_WIDTH = 560;

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
 * Columns for a grid whose tile count is FIXED and must divide evenly.
 *
 * `gridColumns` is right for an open-ended list, where a short last row is just
 * the end of the data. It is wrong for a closed set like the browse doorways:
 * those are twelve tiles chosen so the grid never strands a lone one, and a
 * count that does not divide twelve breaks that by drawing 5 / 5 / 2 with three
 * empty slots and a ragged bottom edge.
 *
 * So the count is snapped to the nearest LEGAL divisor rather than rounded off
 * a target width. `legal` is the caller's set of counts that tile its own item
 * count evenly — the function cannot derive it, because only the caller knows
 * how many items there are.
 */
export function snappedColumns(width: number, pad: number, legal: number[], target = 220): number {
  const ideal = (width - pad * 2) / target;
  return legal.reduce((best, n) => (Math.abs(n - ideal) < Math.abs(best - ideal) ? n : best));
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
 * The aspect the character page's hero image and every rail card share.
 *
 * These two MUST agree. The Apple Zoom transition morphs a rail card into the
 * detail image, and it only fills edge to edge — with no navy peeking through
 * mid-flight — while the card and the image have the same shape. Two files
 * deriving "the same" ratio independently is precisely how that drifts, so it
 * is written down once, here.
 *
 * Clamped because the raw height/width ratio INVERTS on a wide window: on a
 * landscape iPad the unclamped number drops below 1 and the portrait card comes
 * out landscape. 1.1–1.5 keeps it a portrait at every window size.
 */
export function heroImageAspect(width: number, height: number): number {
  return Math.min(Math.max((height * 0.66) / width, 1.1), 1.5);
}

/**
 * The billboard's height.
 *
 * Half the window height is right in portrait and far too tall in landscape,
 * where it would leave nothing else on screen. Capped against the width too, so
 * the hero image keeps a sane aspect instead of becoming a letterbox.
 */
/**
 * The character page's hero block: how wide the art is, and how tall that makes
 * it.
 *
 * The aspect is always `heroImageAspect` of the block's OWN width, never the
 * window's — that is what keeps the Apple Zoom morph honest. The rail card and
 * the hero image have to be the same shape or navy shows through mid-flight
 * (see `heroImageAspect` above), and the way to keep that true while shrinking
 * the block is to shrink its width and let the height follow, rather than
 * capping the height and squashing the aspect.
 *
 * - Phone and tablet `tall`: full-bleed, `width × aspect`, exactly as before.
 *   An iPad in portrait is 1032×1376, so the art is 82% of the fold — more than
 *   the phone's 66%, but the identity block and the sheet's lip are both still
 *   on screen, and the page reads as the phone's design at a larger size. That
 *   is the point of keeping portrait stacked. Inset it and it stops being
 *   full-bleed art for a few points of scroll nobody asked for.
 * - Tablet `wide`: the art is a COLUMN, 44% of the window. At 1376×1032 that is
 *   a 605×666 portrait, which fits the viewport whole — the thing the
 *   full-bleed 1514pt version could never do.
 */
export function heroBlock(
  width: number,
  height: number,
): { width: number; height: number; shape: TabletShape } {
  const shape = tabletShape(width, height);
  const w = shape === 'wide' ? Math.round(width * 0.44) : width;
  return { width: w, height: Math.round(w * heroImageAspect(w, height)), shape };
}

export function spotlightHeightFor(width: number, height: number, insetTop = 0): number {
  const half = height * 0.5;
  const capped = isTabletWidth(width) ? Math.min(half, width * 0.62) : half;
  return Math.round(capped + insetTop);
}
