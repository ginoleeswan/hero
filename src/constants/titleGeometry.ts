import { line } from './typeScale';
// src/constants/titleGeometry.ts — numbers the title page, its header and its
// skeleton share. Same rule as category/issueGeometry: placeholders read the
// source, they do not restate it.
export const TITLE_STAGE = {
  /** FilmBackdropHeader's native minimum height. */
  minHeight: 340,
  /** Native bottom clearance passed to the header — the beige cap overlaps
   *  SEAM.overlap of it, so the real clearance is this minus that. */
  paddingBottom: 44,
  /** The beige cap's height at the ink→paper seam. */
  capHeight: line(30),
} as const;
