#!/usr/bin/env node
// One command → a week of ready-to-post content. Composes the existing ad
// generators (brand / matchup / ranking) into a dated folder with day-prefixed
// images + captions. The mix rotates by ISO week so consecutive weeks differ.
//
//   node scripts/social/ads/batch-week.mjs             # 7 posts, 4x5 (IG feed)
//   node scripts/social/ads/batch-week.mjs --size 1x1
//   node scripts/social/ads/batch-week.mjs --dry-run   # print the plan only
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUT_DIR, RIVALRIES, loadEnv, makeSb, heroByName } from '../lib.mjs';

const ADS = dirname(fileURLToPath(import.meta.url));
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BRAND_STYLES = ['constellation', 'powerstats', 'dossier', 'scale', 'versus', 'leaderboard'];
const RANKINGS = [
  ['fame', 'top-10-most-famous'],
  ['strength', 'top-10-strongest'],
  ['intelligence', 'top-10-smartest'],
  ['speed', 'top-10-fastest'],
];

// Weekly rotation seed — same week = same plan (idempotent), next week differs.
const week = Math.floor(Date.now() / 604_800_000);

// Only rivalries whose BOTH names exact-match the heroes table (names drift).
async function resolvableRivalries() {
  const sb = makeSb(loadEnv());
  const checks = await Promise.all(RIVALRIES.map(async ([a, b]) =>
    ((await heroByName(sb, a)) && (await heroByName(sb, b))) ? [a, b] : null));
  return checks.filter(Boolean);
}

function buildPlan(pool) {
  const bs = (i) => BRAND_STYLES[(week + i) % BRAND_STYLES.length];
  const riv = (i) => pool[(week * 2 + i) % pool.length];
  const rank = (i) => RANKINGS[(week + i) % RANKINGS.length];
  // Mon..Sun: brand / matchup / ranking / brand / matchup / brand / ranking
  return [
    { kind: 'brand', style: bs(0) },
    { kind: 'matchup', pair: riv(0) },
    { kind: 'ranking', by: rank(0)[0], slug: rank(0)[1] },
    { kind: 'brand', style: bs(1) },
    { kind: 'matchup', pair: riv(1) },
    { kind: 'brand', style: bs(2) },
    { kind: 'ranking', by: rank(1)[0], slug: rank(1)[1] },
  ];
}

// Chrome launches flake occasionally — retry each generator before giving up.
function run(script, args, tries = 3) {
  for (let t = 1; ; t++) {
    try { return execFileSync(process.execPath, [join(ADS, script), ...args], { stdio: 'inherit' }); }
    catch (e) {
      if (t >= tries) throw e;
      console.warn(`  retry ${t}/${tries - 1} for ${script}…`);
    }
  }
}

const slugPair = ([a, b]) => `${a}-vs-${b}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function sources(post, size) {
  // Where each generator leaves its output → [image, caption]
  if (post.kind === 'brand') {
    const d = join(OUT_DIR, 'ad-brand');
    return [join(d, `${post.style}-${size}.png`), join(d, 'caption.txt')];
  }
  if (post.kind === 'matchup') {
    // ad-matchup orders the pair by hero id, so the folder may be either order.
    const [a, b] = post.pair;
    let d = join(OUT_DIR, `ad-matchup-${slugPair([a, b])}`);
    if (!existsSync(join(d, `${size}.png`))) d = join(OUT_DIR, `ad-matchup-${slugPair([b, a])}`);
    return [join(d, `${size}.png`), join(d, 'caption.txt')];
  }
  const d = join(OUT_DIR, `ad-ranking-${post.slug}`);
  return [join(d, `${size}.png`), join(d, 'caption.txt')];
}

const label = (post) =>
  post.kind === 'brand' ? `brand-${post.style}`
    : post.kind === 'matchup' ? `matchup-${slugPair(post.pair)}`
      : `ranking-${post.slug}`;

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const size = get('--size', '4x5');
  const dry = args.includes('--dry-run');

  const pool = await resolvableRivalries();
  if (!pool.length) { console.error('No rivalry pair resolves against the heroes table.'); process.exit(1); }
  const plan = buildPlan(pool);
  console.log(`Week plan (rotation #${week}, size ${size}):`);
  plan.forEach((p, i) => console.log(`  ${DAYS[i]}  ${label(p)}`));
  if (dry) return;

  const stamp = new Date().toISOString().slice(0, 10);
  const weekDir = join(OUT_DIR, `week-${stamp}`);
  mkdirSync(weekDir, { recursive: true });

  const lines = [`# Mythique — content week ${stamp}`, '', `Size: ${size} · rotation #${week}`, ''];
  for (let i = 0; i < plan.length; i++) {
    const post = plan[i];
    console.log(`\n[${DAYS[i]}] ${label(post)}`);
    if (post.kind === 'brand') run('ad-brand.mjs', ['--style', post.style, '--size', size]);
    else if (post.kind === 'matchup') run('ad-matchup.mjs', ['--matchup', post.pair.join(','), '--size', size]);
    else run('ad-ranking.mjs', ['--by', post.by, '--size', size]);

    const [img, cap] = sources(post, size);
    const base = `${String(i + 1).padStart(2, '0')}-${DAYS[i]}-${label(post)}`;
    if (!existsSync(img)) { console.error(`  !! expected output missing: ${img}`); continue; }
    copyFileSync(img, join(weekDir, `${base}.png`));
    if (existsSync(cap)) copyFileSync(cap, join(weekDir, `${base}.caption.txt`));
    lines.push(`- **${DAYS[i]}** — ${label(post)} (\`${base}.png\`)`);
  }
  lines.push('', 'Post one per day; paste the matching `.caption.txt`. Reels/stories: re-run with `--size 9x16`.');
  writeFileSync(join(weekDir, 'PLAN.md'), lines.join('\n') + '\n');
  console.log(`\nWeek ready → ${weekDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
