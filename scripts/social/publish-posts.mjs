#!/usr/bin/env node
// Publish the launch pack + latest content week to the app: uploads images to
// Cloudinary and upserts rows into social_posts, so the command-center Social
// lane can drive posting from any device (posted-state lives in the DB).
//
//   node scripts/social/publish-posts.mjs            # launch + latest week
//   node scripts/social/publish-posts.mjs --dry-run
//
// Requires SUPABASE_SERVICE_ROLE_KEY + CLOUDINARY_* in .env.local (local only —
// never shipped). Idempotent: re-publishing overwrites the same (batch, ord).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { suggestMusic } from './music.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'out', 'social');

// ---- env (same loader pattern as lib.mjs, plus private keys) ----
function env() {
  const out = {};
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  for (const k of ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!(process.env[k] || out[k])) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
    out[k] = process.env[k] || out[k];
  }
  return out;
}

const slides = (dir) => {
  try { return readdirSync(dir).filter((f) => /\.png$/.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })); }
  catch { return []; }
};
const readCap = (dir) => { try { return readFileSync(join(dir, 'caption.txt'), 'utf8').trim(); } catch { return ''; } };

// ---- collect posts ----
const LAUNCH = [
  { ord: 1, day: 'day 1', kind: 'ranking', title: 'Top 10 Most Famous Villains', dir: 'ranking-top-10-most-famous-villains', where: 'IG feed', when: '12:00–14:00' },
  { ord: 2, day: 'day 2', kind: 'bio', title: 'Character File: Batman', dir: 'bio-batman', where: 'IG feed', when: '12:00–14:00' },
  { ord: 3, day: 'day 3', kind: 'matchup', title: 'Goku vs Superman', dir: join('goku-vs-superman', 'carousel'), where: 'IG feed → story + poll', when: '18:00–20:00' },
];
const WEEK_GUIDE = { brand: ['IG feed · X', '11:00–13:00'], matchup: ['IG feed → story + poll', '18:00–20:00'], ranking: ['IG feed', '12:00–14:00'] };

function collect() {
  const posts = [];
  for (const s of LAUNCH) {
    const dir = join(OUT, s.dir);
    const ss = slides(dir);
    if (ss.length) posts.push({ batch: 'launch', ord: s.ord, day: s.day, kind: s.kind, title: s.title, dir, files: ss, caption: readCap(dir), where: s.where, when: s.when });
  }
  const weeks = readdirSync(OUT).filter((d) => /^week-\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const wk = weeks[weeks.length - 1];
  if (wk) {
    const dir = join(OUT, wk);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.png')).sort()) {
      const m = f.match(/^(\d+)-(\w+)-(\w+?)-(.+)\.png$/);
      if (!m) continue;
      const [, ord, day, kind, rest] = m;
      const g = WEEK_GUIDE[kind] || ['', ''];
      let caption = '';
      try { caption = readFileSync(join(dir, f.replace(/\.png$/, '.caption.txt')), 'utf8').trim(); } catch { /* none */ }
      posts.push({ batch: wk, ord: Number(ord), day, kind, title: rest.replace(/-/g, ' '), dir, files: [f], caption, where: g[0], when: g[1] });
    }
  }
  return posts;
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const E = env();
  const posts = collect();
  if (!posts.length) { console.error('Nothing to publish — generate the launch pack / a week first.'); process.exit(1); }
  console.log(`Publishing ${posts.length} posts (${[...new Set(posts.map((p) => p.batch))].join(', ')})`);
  if (dry) { for (const p of posts) console.log(`  ${p.batch} #${p.ord} ${p.title} — ${p.files.length} slide(s)`); return; }

  cloudinary.config({ cloud_name: E.CLOUDINARY_CLOUD_NAME, api_key: E.CLOUDINARY_API_KEY, api_secret: E.CLOUDINARY_API_SECRET });

  const rows = [];
  for (const p of posts) {
    const urls = [];
    for (const f of p.files) {
      const publicId = `mythique/social/${p.batch}/${p.ord}-${f.replace(/\.png$/, '')}`;
      const r = await cloudinary.uploader.upload(join(p.dir, f), { public_id: publicId, overwrite: true, resource_type: 'image' });
      urls.push(r.secure_url);
      process.stdout.write('.');
    }
    rows.push({
      batch: p.batch, ord: p.ord, day: p.day, kind: p.kind, title: p.title,
      image_url: urls[0], slide_urls: urls, caption: p.caption,
      guide_where: p.where, guide_when: p.when,
      guide_music: suggestMusic(p.kind, p.title),
      // Everything from the organic studio is organic-only (never boost as a
      // paid ad) — the tier-checked ads pipeline publishes 'ad_safe' rows.
      ad_safety: 'organic',
    });
  }
  console.log('\nImages uploaded. Upserting rows…');

  const res = await fetch(`${E.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/social_posts?on_conflict=batch,ord`, {
    method: 'POST',
    headers: {
      apikey: E.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) { console.error(`Upsert failed: ${res.status} ${await res.text()}`); process.exit(1); }
  console.log(`Published ${rows.length} posts → command center › Social.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
