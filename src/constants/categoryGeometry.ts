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
import { gridColumns } from './layout';
import { line } from './typeScale';

/**
 * The grid, for a given window width.
 *
 * This was `SCREEN_WIDTH >= 768 ? 4 : 3` evaluated once at import — someone had
 * already thought about tablets, but the answer was computed before the app had
 * ever been rotated, so on an iPad it kept its launch value forever. Worse for
 * this file than for most: the screen and its skeleton BOTH read it, and the
 * whole point of the file is that they agree.
 *
 * Columns now come from a target card width, so the grid grows smoothly through
 * the intermediate widths a Split View drag passes through.
 */
export function categoryGrid(width: number) {
  const hPad = 16;
  const gap = 8;
  const columns = gridColumns(width, 120, 3, 7);
  const cardW = (width - hPad * 2 - gap * (columns - 1)) / columns;
  return { columns, gap, hPad, cardW, cardH: Math.round(cardW * 1.35) };
}

/**
 * The navy stage's vertical rhythm. `titleLine` and `taglineLine` are the real
 * `lineHeight`s, not font sizes — a placeholder bar has to occupy the line box
 * the text will, or the swap moves everything below it.
 */
export const CATEGORY_STAGE = {
  titleLine: line(40),
  taglineGap: 8,
  taglineLine: line(18),
  paddingBottom: 36,
  /** The beige cap's height; it overlaps the stage by SEAM.overlap. */
  capHeight: line(30),
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
