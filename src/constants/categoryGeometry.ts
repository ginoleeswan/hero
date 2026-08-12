// src/constants/categoryGeometry.ts — the numbers the category screen and its
// skeleton BOTH lay out from.
//
// They were duplicated, and duplicated numbers drift: the skeleton was still
// drawing an eyebrow the screen had stopped rendering, padding its stage 26
// against the screen's 36, and starting its first grid row 4pt higher than the
// real one. Content landing shifted the whole grid ~37pt, which is the jump you
// see as a page resolves.
//
// The rule is the one HomeSkeleton already follows via PUBLISHER_GRID: if a
// placeholder claims to mirror a layout, it has to read from the same source.
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CATEGORY_GRID = {
  columns: SCREEN_WIDTH >= 768 ? 4 : 3,
  gap: 8,
  /** Shared horizontal inset for the stage, the sheet and the grid. */
  hPad: 16,
} as const;

export const CATEGORY_CARD_W =
  (SCREEN_WIDTH - CATEGORY_GRID.hPad * 2 - CATEGORY_GRID.gap * (CATEGORY_GRID.columns - 1)) /
  CATEGORY_GRID.columns;
export const CATEGORY_CARD_H = Math.round(CATEGORY_CARD_W * 1.35);

/**
 * The navy stage's vertical rhythm. `titleLine` and `taglineLine` are the real
 * `lineHeight`s, not font sizes — a placeholder bar has to occupy the line box
 * the text will, or the swap moves everything below it.
 */
export const CATEGORY_STAGE = {
  titleLine: 40,
  taglineGap: 8,
  taglineLine: 18,
  paddingBottom: 36,
  /** The beige cap's height; it overlaps the stage by SEAM.overlap. */
  capHeight: 30,
  /** Registered universes swap the title line for a brand masthead at this
   *  height — 16pt taller than a title line, so a placeholder that always drew
   *  a title moved the whole grid on every /universe/* page. */
  logoHeight: 56,
} as const;

/**
 * Ink heights for the placeholder bars. The BOX a bar sits in is the real
 * line box (`titleLine` / `taglineLine`), because that is what sets where
 * everything below it starts; the bar drawn inside it is the height of the
 * glyphs, because a bar filling the whole line box reads as a slab rather than
 * as a line of text.
 */
export const CATEGORY_INK = {
  title: 30,
  tagline: 12,
} as const;
