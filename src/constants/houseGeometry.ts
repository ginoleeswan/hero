// src/constants/houseGeometry.ts — the numbers the house page and HouseSkeleton
// BOTH lay out from.
//
// They were not shared, and the placeholder was drawing the WEB page on native:
// a 20pt gutter against the native body's 16, a 24pt top pad against 16, an 18pt
// stack gap against 22. It also drew a whole roster rail — heading, search
// field, nine name rows — which native does not have at all (names are chosen in
// a sheet over the console) and which mobile web gates behind its two-column
// breakpoint. And neither the native nor the web placeholder drew the stage
// switch that sits between the console and the chart on both.
//
// Same rule as categoryGeometry / eventGeometry: a placeholder that claims to
// mirror a layout reads from the same source.

/** app/house/[slug].tsx — the native body's own metrics. */
export const HOUSE_BODY_NATIVE = {
  pad: 16,
  gap: 18,
} as const;

/** app/house/[slug].web.tsx — the web workspace's. */
export const HOUSE_BODY_WEB = {
  pad: 20,
  paddingTop: 24,
  paddingBottom: 56,
  gap: 22,
  gapWide: 28,
  /** The stage column's internal stack: console → switch → chart. */
  stackGap: 18,
} as const;

/** StageSwitch's resting height: a 12.5/17 label in a 7pt-padded option, inside
 *  a 4pt-padded, 1pt-bordered track. */
export const STAGE_SWITCH = {
  labelLine: 17,
  optionPaddingVertical: 7,
  trackPadding: 4,
  trackBorder: 1,
} as const;

export const STAGE_SWITCH_HEIGHT =
  STAGE_SWITCH.labelLine +
  STAGE_SWITCH.optionPaddingVertical * 2 +
  STAGE_SWITCH.trackPadding * 2 +
  STAGE_SWITCH.trackBorder * 2;
