export interface Powerstats {
  intelligence: number | null;
  strength: number | null;
  speed: number | null;
  durability: number | null;
  power: number | null;
  combat: number | null;
}

export interface StatEdge {
  /** Display label, e.g. "Speed". */
  label: string;
  subject: number;
  node: number;
  /** node − subject; positive means the focused character wins this stat. */
  delta: number;
}

const STATS: { key: keyof Powerstats; label: string }[] = [
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'strength', label: 'Strength' },
  { key: 'speed', label: 'Speed' },
  { key: 'durability', label: 'Durability' },
  { key: 'power', label: 'Power' },
  { key: 'combat', label: 'Combat' },
];

/**
 * The few stats where these two characters differ most.
 *
 * Six side-by-side bars is a spec sheet, and nobody reads a spec sheet inside a
 * hover card. The interesting thing about a matchup is where it's LOPSIDED, so
 * this ranks by absolute gap and returns the top few — "much faster, far less
 * durable" is a story; six near-identical bars is furniture.
 *
 * Stats are frequently missing on lesser-known characters, so any pair where
 * either side is null is dropped rather than treated as zero, which would
 * invent a landslide out of absent data.
 */
export function topStatEdges(
  subject: Powerstats | null,
  node: Powerstats | null,
  limit = 3,
): StatEdge[] {
  if (!subject || !node) return [];
  const rows: StatEdge[] = [];
  for (const { key, label } of STATS) {
    const a = subject[key];
    const b = node[key];
    if (a == null || b == null) continue;
    if (a === 0 && b === 0) continue;
    rows.push({ label, subject: a, node: b, delta: b - a });
  }
  return rows
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.label.localeCompare(y.label))
    .slice(0, limit);
}

/**
 * One-line verdict on the overall matchup, for the card's action row.
 * Returns null when either total is missing — silence beats a made-up call.
 */
export function matchupVerdict(
  subjectTotal: number | null,
  nodeTotal: number | null,
  nodeName: string,
  subjectName: string,
): string | null {
  if (subjectTotal == null || nodeTotal == null || subjectTotal === 0 || nodeTotal === 0) {
    return null;
  }
  const diff = nodeTotal - subjectTotal;
  const ratio = Math.abs(diff) / Math.max(subjectTotal, nodeTotal);
  if (ratio < 0.05) return 'Dead even on paper';
  const winner = diff > 0 ? nodeName : subjectName;
  return ratio > 0.25 ? `${winner} dominates on paper` : `${winner} edges it on paper`;
}
