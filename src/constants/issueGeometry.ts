import { line } from './typeScale';
// src/constants/issueGeometry.ts — the numbers the issue page and its skeleton
// BOTH lay out from. Same rule as categoryGeometry: a placeholder that claims
// to mirror a layout reads from the same source, or it drifts.
export const ISSUE_STAGE = {
  /** The narrow header's minimum height (blurred cover + centred masthead). */
  minHeight: 430,
  /** Bottom padding inside the header; the beige cap overlaps SEAM.overlap of
   *  it, so real masthead clearance is this minus that. */
  paddingBottom: 44,
  /** The beige cap's height at the ink→paper seam. */
  capHeight: line(30),
} as const;
