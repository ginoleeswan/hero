// src/lib/family/tierLabels.ts
// Row labels for generation tiers, shared by buildFamilyGraph (section headings)
// and layoutFamily (axis rows) so the two can never drift.
//
// Tiers used to stop at ±2 because that is the whole of an ordinary family. Some
// lineages are genuinely recorded deeper — Daenerys Targaryen's runs twelve
// generations back to Aegon the Conqueror — so anything above the named tiers
// gets a generated label instead of a blank one.

/** Headings for the tiers a normal family has. */
export const GRAPH_TIER_LABELS: Record<number, string> = {
  2: 'Grandparents',
  1: 'Parents · Aunts & Uncles',
  0: 'Same generation',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

/** Axis labels, phrased for the tree view's row gutter. */
export const LAYOUT_TIER_LABELS: Record<number, string> = {
  2: 'Grandparents',
  1: 'Parents · aunts',
  0: 'Hero · siblings',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

/**
 * "Great-grandparents", "Great-great-grandparents", then a multiplier — spelling
 * out ten "great"s is unreadable, which is exactly what the raw data produced.
 * `depth` is the number of generations away, always positive.
 */
function deepLabel(depth: number, noun: 'grandparents' | 'grandchildren'): string {
  if (depth === 3) return `Great-${noun}`;
  if (depth === 4) return `Great-great-${noun}`;
  return `${depth - 2}× great-${noun}`;
}

export function tierLabel(tier: number, base: Record<number, string>): string {
  const fixed = base[tier];
  if (fixed !== undefined) return fixed;
  if (tier > 2) return deepLabel(tier, 'grandparents');
  if (tier < -2) return deepLabel(-tier, 'grandchildren');
  return '';
}
