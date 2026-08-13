// Catalogue IP-risk audit. buildReport is pure (tested); the CLI wrapper that
// fetches real rows and writes the report is added below (guarded main).
// Design: docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md
import { PUBLISHER_TIER, tierOf } from './safety.mjs';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv, makeSb, OUT_DIR } from './lib.mjs';

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

// Full-catalogue scan — paginate under the PostgREST 1000-row cap.
async function fetchAllHeroes(sb, pageSize = 1000) {
  const cols = 'id,name,publisher,fame_score';
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await sb.rest(`heroes?select=${cols}&order=id.asc&limit=${pageSize}&offset=${offset}`);
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

export function renderMarkdown(report) {
  const { total, tierTotals, tierFamous, publishers, untieredPublishers, safeFaceBands } = report;
  const L = [];
  L.push(`# Mythique catalogue — IP risk audit`, ``, `Generated ${new Date().toISOString()}`, ``);
  L.push(`Total heroes: **${total.toLocaleString()}**`, ``);
  L.push(`## Tier distribution`, ``, `| Tier | Total | Famous (fame ≥ 40) |`, `| --- | ---: | ---: |`);
  for (const t of ['S', 'A', 'B', 'C']) L.push(`| ${t} | ${tierTotals[t]} | ${tierFamous[t]} |`);
  L.push(``, `## Safe-face pool (Tier C by fame band)`, ``, `| Fame band | Tier-C count |`, `| --- | ---: |`);
  for (const b of safeFaceBands) L.push(`| ${b.label} | ${b.count} |`);
  L.push(``, `## Untiered publishers (defaulting to Tier A — review & assign)`, ``);
  L.push(untieredPublishers.length ? untieredPublishers.map((p) => `- ${p}`).join('\n') : '_none — full coverage_');
  L.push(``, `## Publishers by famous-character count`, ``, `| Publisher | Tier | Total | Famous |`, `| --- | --- | ---: | ---: |`);
  for (const p of publishers.slice(0, 60)) L.push(`| ${p.publisher} | ${p.tier} | ${p.total} | ${p.famous} |`);
  return L.join('\n') + '\n';
}

async function main() {
  const sb = makeSb(loadEnv());
  console.log('Scanning catalogue…');
  const rows = await fetchAllHeroes(sb);
  const report = buildReport(rows);
  const md = renderMarkdown(report);
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'safety-report.md');
  writeFileSync(outPath, md);
  console.log(`\nTotal: ${report.total}`);
  console.log('Tier totals:', report.tierTotals);
  console.log('Tier famous:', report.tierFamous);
  console.log('Untiered publishers:', report.untieredPublishers.join(', ') || '(none)');
  console.log(`\nReport written to ${outPath}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
