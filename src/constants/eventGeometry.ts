// src/constants/eventGeometry.ts — the numbers EventDossier / EventIndexList
// and their skeletons BOTH lay out from.
//
// They were not shared, and the placeholder was ~180pt shorter than the page it
// stood in for: it drew nothing at all for the method paragraph, gave the stat
// rail 40pt where a Flame 40 stat occupies 65, and closed the stage on a 28pt
// pad where the real one reserves 60% of the readership curve's height. Content
// landing shoved the entire dossier down most of a screen.
//
// Same rule as categoryGeometry: if a placeholder claims to mirror a layout, it
// reads from the same source.

/** The ink masthead's vertical rhythm. Line values are line BOXES, not font
 *  sizes — a placeholder bar has to occupy the box the text will. */
export const EVENT_STAGE = {
  pad: 18,
  padWide: 40,
  paddingTop: 28,
  paddingTopWide: 44,

  eyebrowLine: 15,
  /** eyebrow marginBottom */
  eyebrowGap: 12,

  /** Flame 34. Brand-marked events swap it for `markMinHeight`. */
  titleLine: 42,
  markMinHeight: 64,

  windowGap: 12,
  windowLine: 18,

  methodGap: 8,
  methodLine: 21,
  /** The method sentence is a constant, and on phone widths it sets three
   *  lines. The Text is clamped and boxed to exactly that on phone so the
   *  height is a fact rather than a font-metrics guess. */
  methodLines: 3,

  statsGap: 20,
  statsGapWide: 26,
  /** Flame 40 + 2 + a 10pt label line: the tallest stat, which sets the row. */
  statBigLine: 49,
  statValueLine: 32,
  statLabelLine: 14,
  statInnerGap: 2,

  /** The readership curve is pinned to the stage floor and adds no height; the
   *  stat rail's bottom margin is what reserves room to read it over. */
  curveH: 150,
  curveHWide: 190,
  curveClearance: 0.6,
  curveClearanceWide: 0.44,
} as const;

/** The paper band below the seam. */
export const EVENT_PAPER = {
  paddingTop: 34,
  paddingBottom: 64,
  sectionMarginBottom: 42,
  sectionTitleLine: 32,
  sectionNoteGap: 2,
  sectionNoteLine: 19,
  sectionBodyGap: 18,
  /** The lead trailer's backdrop. */
  leadAspect: 16 / 8,
  leadRadius: 14,
} as const;

/** app/event/index.tsx — the record. Its own rhythm, not the dossier's: a
 *  bigger headline, a tighter eyebrow, and rows built around a bleeding curve. */
export const EVENT_INDEX = {
  stagePaddingBottom: 28,
  eyebrowLine: 15,
  eyebrowGap: 10,
  titleLine: 45,
  methodGap: 10,
  methodLine: 21,
  methodLines: 3,

  paperPaddingTop: 30,
  paperPaddingBottom: 64,

  rowPaddingVertical: 22,
  rowGap: 8,
  rowTitleLine: 30,
  rowWindowLine: 16,
  rowCurveGap: 10,
  rowCurveH: 76,
  rowCurveHWide: 64,
  rowStatLine: 18,
  rowBorder: 1,
} as const;

/** Ink heights for placeholder bars — see CATEGORY_INK for the reasoning. */
export const EVENT_INK = {
  eyebrow: 11,
  title: 30,
  window: 13,
  method: 13,
  statBig: 38,
  statValue: 24,
  statLabel: 10,
  sectionTitle: 23,
  sectionNote: 13,
} as const;
