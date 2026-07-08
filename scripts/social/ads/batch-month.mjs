#!/usr/bin/env node
// One command → a month of ad-safe content. Plan (seeded) → render every
// entry (carousels + reels) → manifest.json + a visual gallery for triage.
//
//   node scripts/social/ads/batch-month.mjs                    # ~30 pieces
//   node scripts/social/ads/batch-month.mjs --n 12 --seed 9
//   node scripts/social/ads/batch-month.mjs --dry-run          # plan only
//   node scripts/social/ads/batch-month.mjs --exclude-tier-s
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR } from '../lib.mjs';
import { fetchPools } from './data.mjs';
import { buildPlan, rng } from './plan.mjs';
import { renderCarousel } from './render-carousel.mjs';
import { renderReel } from './render-reel.mjs';
import { relative } from 'node:path';

function gallery(batch, entries) {
  const cell = (e) => `<div class="c"><div class="k">${e.ord} · ${e.angle} · ${e.format}</div>
    ${e.format === 'reel' ? `<video src="${e.dir}/${e.mp4}" poster="${e.dir}/${e.poster}" controls muted></video>` : `<img src="${e.dir}/${e.slides[0]}" loading="lazy">`}
    <div class="t">${e.title}</div></div>`;
  return `<!doctype html><meta charset="utf-8"><title>${batch}</title><style>body{font:14px -apple-system,sans-serif;background:#0b1820;color:#f5ebdc;padding:24px}h1{margin-bottom:16px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}.c{background:rgba(255,255,255,.04);border-radius:12px;padding:10px}.c img,.c video{width:100%;border-radius:8px}.k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#e0a83e;margin-bottom:8px}.t{margin-top:8px;font-weight:700}</style>
  <h1>${batch} · ${entries.length} pieces</h1><div class="g">${entries.map(cell).join('')}</div>`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, dv) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : dv; };
  const n = Number(get('--n', 30));
  const seed = Number(get('--seed', Math.floor(Date.now() / 2_592_000_000))); // month-derived default
  const dry = args.includes('--dry-run');
  const excludeTierS = args.includes('--exclude-tier-s');
  const mix = { carousel: Number(get('--carousels', 18)), reel: Number(get('--reels', 12)) };

  const sb = makeSb(loadEnv());
  const rand = rng(seed);
  console.log(`Fetching ad-safe data pools…`);
  const pools = await fetchPools(sb, rand, { excludeTierS });
  const plan = buildPlan({ n, seed, mix, pools });
  console.log(`Plan: ${plan.length} entries (seed ${seed})`);
  for (const e of plan) console.log(`  ${String(e.ord).padStart(2, '0')}  ${e.format.padEnd(8)} ${e.angle.padEnd(8)} ${e.title}`);
  if (dry) return;

  const stamp = new Date().toISOString().slice(0, 7); // YYYY-MM
  const batch = `ad-library-${stamp}`;
  const outDir = join(OUT_DIR, batch);
  mkdirSync(outDir, { recursive: true });
  const F = fonts();
  const manifest = { batch, seed, entries: [] };
  for (const e of plan) {
    console.log(`\n[${e.ord}/${plan.length}] ${e.format} · ${e.title}`);
    if (e.format === 'carousel') {
      const { dir, slides } = await renderCarousel(e, { outDir, F });
      manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, dir), slides: slides.map((s) => relative(dir, s)) });
    } else {
      const { dir, mp4, poster } = await renderReel(e, { outDir, F });
      manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, dir), mp4: relative(dir, mp4), poster: relative(dir, poster) });
    }
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, 'gallery.html'), gallery(batch, manifest.entries));
  console.log(`\nLibrary ready → ${outDir}\nOpen the gallery: open "${join(outDir, 'gallery.html')}"\nPublish it:       node scripts/social/publish-posts.mjs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
