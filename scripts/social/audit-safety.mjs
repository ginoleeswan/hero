// Catalogue IP-risk audit. buildReport is pure (tested); the CLI wrapper that
// fetches real rows and writes the report is added below (guarded main).
// Design: docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md
import { PUBLISHER_TIER, tierOf } from './safety.mjs';

const BANDS = [
  { label: '80-100', min: 80 },
  { label: '60-79', min: 60 },
  { label: '40-59', min: 40 },
  { label: '20-39', min: 20 },
  { label: '1-19', min: 1 },
  { label: '0', min: 0 },
];

const bandFor = (fame) => BANDS.find((b) => (fame ?? 0) >= b.min).label;

export function buildReport(rows, { famousMin = 40 } = {}) {
  const tierTotals = { S: 0, A: 0, B: 0, C: 0 };
  const tierFamous = { S: 0, A: 0, B: 0, C: 0 };
  const byPub = new Map(); // publisher -> { publisher, tier, total, famous }
  const safeBands = new Map(BANDS.map((b) => [b.label, 0]));

  for (const h of rows) {
    const tier = tierOf(h);
    const famous = (h.fame_score ?? 0) >= famousMin;
    tierTotals[tier]++;
    if (famous) tierFamous[tier]++;

    const pub = h.publisher ?? '(none)';
    if (!byPub.has(pub)) byPub.set(pub, { publisher: pub, tier, total: 0, famous: 0 });
    const rec = byPub.get(pub);
    rec.total++;
    if (famous) rec.famous++;

    if (tier === 'C') safeBands.set(bandFor(h.fame_score), safeBands.get(bandFor(h.fame_score)) + 1);
  }

  const publishers = [...byPub.values()].sort((a, b) => b.famous - a.famous || b.total - a.total);
  const untieredPublishers = publishers
    .filter((p) => p.publisher !== '(none)' && !Object.prototype.hasOwnProperty.call(PUBLISHER_TIER, p.publisher))
    .map((p) => p.publisher);
  const safeFaceBands = BANDS.map((b) => ({ label: b.label, count: safeBands.get(b.label) }));

  return { total: rows.length, tierTotals, tierFamous, publishers, untieredPublishers, safeFaceBands };
}
