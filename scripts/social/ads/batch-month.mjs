#!/usr/bin/env node
// One command → a month of ad-safe content. Plan (seeded) → render every
// entry (carousels + reels) → manifest.json + a visual gallery for triage.
// The manifest + gallery are rewritten after EVERY entry, so the batch is
// checkable (gallery) and publishable (publish-posts.mjs) while it renders —
// stop it any time and what's done is usable.
//
//   node scripts/social/ads/batch-month.mjs                    # ~30 pieces
//   node scripts/social/ads/batch-month.mjs --n 12 --seed 9
//   node scripts/social/ads/batch-month.mjs --dry-run          # plan only
//   node scripts/social/ads/batch-month.mjs --exclude-tier-s
//   node scripts/social/ads/batch-month.mjs --resume           # keep finished entries, render the rest
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR } from '../lib.mjs';
import { fetchPools } from './data.mjs';
import { buildPlan, rng } from './plan.mjs';
import { fetchAngleViews, medianViewsByFamily, weightedCycle, describeCycle } from './weights.mjs';
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
  const resume = args.includes('--resume');
  const excludeTierS = args.includes('--exclude-tier-s');
  const mix = { carousel: Number(get('--carousels', 18)), reel: Number(get('--reels', 12)) };

  const sb = makeSb(loadEnv());
  const rand = rng(seed);
  console.log(`Fetching ad-safe data pools…`);
  const pools = await fetchPools(sb, rand, { excludeTierS });
  // Measured rebias: weight the angle cycle by median views per angle family
  // (needs the service-role key to read social_post_results — falls back to
  // the static cycle, loudly, when there's no data). --no-rebias forces static.
  let angles = null;
  if (!args.includes('--no-rebias')) {
    const measured = await fetchAngleViews(sb);
    if (measured) {
      angles = weightedCycle(['matchup', 'ranking', 'guess', 'fact', 'lore'], medianViewsByFamily(measured), { slots: 7 });
      console.log(`Measured rebias: ${describeCycle(angles)} (from ${measured.length} measured posts)`);
    } else {
      console.log('No measured results readable — using the static angle cycle.');
    }
  }
  const plan = buildPlan({ n, seed, mix, pools, angles });
  console.log(`Plan: ${plan.length} entries (seed ${seed})`);
  for (const e of plan) console.log(`  ${String(e.ord).padStart(2, '0')}  ${e.format.padEnd(8)} ${e.angle.padEnd(8)} ${e.title}`);
  if (dry) return;

  const stamp = new Date().toISOString().slice(0, 7); // YYYY-MM
  const batch = `ad-library-${stamp}`;
  const outDir = join(OUT_DIR, batch);
  // Fresh runs regenerate the batch whole (no stale orphans); --resume keeps
  // finished entries (same seed ⇒ same plan) and renders only what's missing.
  if (!resume) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const F = fonts();
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const manifest = { batch, seed, entries: [] };
  // Rewritten after every entry so a partial batch is immediately usable.
  const flush = () => {
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    writeFileSync(join(outDir, 'gallery.html'), gallery(batch, manifest.entries));
  };
  for (const e of plan) {
    const entryDir = join(outDir, `${String(e.ord).padStart(2, '0')}-${slugify(e.title)}`);
    // Written ONLY after the entry fully rendered + manifest flushed for it —
    // a mid-entry kill leaves no .done, so resume re-renders the whole entry
    // instead of trusting a partial slide-1.png/reel.mp4.
    const doneMarker = join(entryDir, '.done');
    if (resume && existsSync(doneMarker)) {
      console.log(`\n[${e.ord}/${plan.length}] ↷ cached · ${e.title}`);
      if (e.format === 'carousel') {
        const { readdirSync } = await import('node:fs');
        const slides = readdirSync(entryDir).filter((f) => /^slide-\d+\.png$/.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
        manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, entryDir), slides });
      } else {
        manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, entryDir), mp4: 'reel.mp4', poster: 'poster.png' });
      }
      flush();
      continue;
    }
    console.log(`\n[${e.ord}/${plan.length}] ${e.format} · ${e.title}`);
    if (e.format === 'carousel') {
      const { dir, slides } = await renderCarousel(e, { outDir, F });
      manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, dir), slides: slides.map((s) => relative(dir, s)) });
    } else {
      const { dir, mp4, poster } = await renderReel(e, { outDir, F });
      manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, dir), mp4: relative(dir, mp4), poster: relative(dir, poster) });
    }
    flush();
    // dir returned by the renderer equals the precomputed entryDir — mark
    // done only now, after manifest.entries.push + flush() succeeded.
    writeFileSync(doneMarker, '');
  }
  console.log(`\nLibrary ready → ${outDir}\nOpen the gallery: open "${join(outDir, 'gallery.html')}"\nPublish it:       node scripts/social/publish-posts.mjs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
