// src/components/home/podGrid.ts — the browse grid's geometry, kept apart from
// the component so it can be tested.
//
// Same reason `deckSelection.ts` exists: a constant living inside a file that
// imports expo-linear-gradient and PressScale cannot be imported by a unit
// test, and a test that re-declares the value would go on passing while the
// screen drew something else.
import { sectionGutter, snappedColumns } from '../../constants/layout';

export const POD_H_PAD = 16;
export const POD_GAP = 12;

/**
 * The column counts that divide BROWSE_PODS' twelve tiles without stranding a
 * short last row.
 *
 * This is the invariant BROWSE_PODS' own comment claims ("change this list in
 * threes") and the grid was quietly breaking: the count was clamped to 2–5, and
 * FIVE is the one value in that range twelve does not divide — so a landscape
 * iPad drew 5 / 5 / 2 with three empty slots and a ragged bottom edge.
 *
 * Six is included and five is not, which is the whole fix.
 */
export const POD_COLUMNS = [2, 3, 4, 6];

/** Tile size and the gutter it sits in, as a pure function of the window. */
export function podTile(width: number): {
  pad: number;
  columns: number;
  size: { width: number; height: number };
} {
  const pad = sectionGutter(width, POD_H_PAD);
  const columns = snappedColumns(width, pad, POD_COLUMNS);
  const w = Math.floor((width - pad * 2 - POD_GAP * (columns - 1)) / columns);
  return { pad, columns, size: { width: w, height: Math.round(w * 0.82) } };
}
