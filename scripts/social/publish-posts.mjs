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
  if (existsSync(p))
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  for (const k of [
    'EXPO_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]) {
    if (!(process.env[k] || out[k])) {
      console.error(`Missing ${k} in .env.local`);
      process.exit(1);
    }
    out[k] = process.env[k] || out[k];
  }
  return out;
}

const slides = (dir) => {
  try {
    return readdirSync(dir)
      .filter((f) => /\.png$/.test(f))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  } catch {
    return [];
  }
};
const readCap = (dir) => {
  try {
    return readFileSync(join(dir, 'caption.txt'), 'utf8').trim();
  } catch {
    return '';
  }
};

// ---- collect posts ----
// The launch pack is the organic studio carousels (they show character art →
// organic-only, never boost). Everything from the ads pipeline (weeks + the
// evergreen brand toolkit) is franchise-free → boostable ('ad_safe').
const LAUNCH = [
  {
    ord: 1,
    day: 'day 1',
    kind: 'ranking',
    title: 'Top 10 Most Famous Villains',
    dir: 'ranking-top-10-most-famous-villains',
    where: 'IG feed',
    when: '12:00–14:00',
  },
  {
    ord: 2,
    day: 'day 2',
    kind: 'bio',
    title: 'Character File: Batman',
    dir: 'bio-batman',
    where: 'IG feed',
    when: '12:00–14:00',
  },
  {
    ord: 3,
    day: 'day 3',
    kind: 'matchup',
    title: 'Goku vs Superman',
    dir: join('goku-vs-superman', 'carousel'),
    where: 'IG feed → story + poll',
    when: '18:00–20:00',
  },
];
const WEEK_GUIDE = {
  brand: ['IG feed · X', '11:00–13:00'],
  matchup: ['IG feed → story + poll', '18:00–20:00'],
  ranking: ['IG feed', '12:00–14:00'],
};

// The six evergreen brand looks (scripts/social/ads/ad-brand.mjs) + the web
// hero. Each brand look ships all ad ratios; we carry them as "slides" so the
// posting UI can grab any ratio (4x5 cover first, then 1x1/9x16/16x9).
const BRAND_STYLES = ['constellation', 'powerstats', 'dossier', 'scale', 'versus', 'leaderboard'];
const RATIOS = ['4x5', '1x1', '9x16', '16x9'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function collect() {
  const posts = [];
  for (const s of LAUNCH) {
    const dir = join(OUT, s.dir);
    const ss = slides(dir);
    if (ss.length)
      posts.push({
        batch: 'launch',
        ord: s.ord,
        day: s.day,
        kind: s.kind,
        title: s.title,
        dir,
        files: ss,
        caption: readCap(dir),
        where: s.where,
        when: s.when,
        adSafety: 'organic',
      });
  }
  const weeks = readdirSync(OUT)
    .filter((d) => /^week-\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const wk = weeks[weeks.length - 1];
  if (wk) {
    const dir = join(OUT, wk);
    for (const f of readdirSync(dir)
      .filter((x) => x.endsWith('.png'))
      .sort()) {
      const m = f.match(/^(\d+)-(\w+)-(\w+?)-(.+)\.png$/);
      if (!m) continue;
      const [, ord, day, kind, rest] = m;
      const g = WEEK_GUIDE[kind] || ['', ''];
      let caption = '';
      try {
        caption = readFileSync(join(dir, f.replace(/\.png$/, '.caption.txt')), 'utf8').trim();
      } catch {
        /* none */
      }
      posts.push({
        batch: wk,
        ord: Number(ord),
        day,
        kind,
        title: rest.replace(/-/g, ' '),
        dir,
        files: [f],
        caption,
        where: g[0],
        when: g[1],
        adSafety: 'ad_safe',
      });
    }
  }
  posts.push(...collectAdToolkit());
  posts.push(...collectAdLibrary());
  posts.push(...collectBrandKit());
  posts.push(...collectOrganicPack());
  return posts;
}

// The monthly organic recognition pack (organic-pack.mjs output) — real
// portraits/covers/posters, so it is ORGANIC ONLY (never boosted).
function collectOrganicPack() {
  const packs = readdirSync(OUT)
    .filter((d) => /^organic-\d{4}-\d{2}$/.test(d))
    .sort();
  const latest = packs[packs.length - 1];
  if (!latest) return [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(OUT, latest, 'manifest.json'), 'utf8'));
  } catch {
    return [];
  }
  return manifest.entries.map((e) => ({
    batch: latest,
    ord: e.ord,
    day: null,
    kind: e.format,
    title: e.title,
    dir: join(OUT, latest, e.dir),
    files: e.slides,
    caption: e.caption,
    where:
      e.format === 'showdown' || e.format === 'legend'
        ? 'IG feed · X'
        : 'IG carousel · TikTok photo',
    when: '',
    adSafety: 'organic',
    angle: e.angle,
  }));
}

// The brand asset kit (brand-pack.mjs output) — profile dressing, the
// "what is Mythique" overview set, and announcement templates. Franchise-free
// by construction (logo/wordmark/mascot + generated silhouettes only).
function collectBrandKit() {
  const kit = join(OUT, 'brand-kit');
  if (!existsSync(kit)) return [];
  const groups = [
    {
      sub: '01-profile',
      title: 'Profile kit — avatar + banners',
      where: 'X · LinkedIn · YouTube · IG',
      order: [
        'avatar-1080.png',
        'banner-x-1500x500.png',
        'banner-linkedin-1584x396.png',
        'banner-youtube-2560x1440.png',
      ],
    },
    {
      sub: '02-overview',
      title: 'Overview — what is Mythique (pin this)',
      where: 'IG carousel · LinkedIn card · story',
      order: [
        'slide-1-4x5.png',
        'slide-2-4x5.png',
        'slide-3-4x5.png',
        'slide-4-4x5.png',
        'slide-5-4x5.png',
        'overview-card-1200x627.png',
        'overview-story-1080x1920.png',
      ],
    },
    {
      sub: '03-announce',
      title: 'Announcement templates',
      where: 'Any channel',
      order: ['launch-4x5.png', 'milestone-4x5.png', 'feature-4x5.png'],
    },
    {
      sub: '04-marks',
      title: 'Logo & wordmark exports',
      where: 'Anywhere',
      order: ['wordmark-cream.png', 'wordmark-navy.png', 'mascot-bust.png'],
    },
  ];
  const posts = [];
  let ord = 1;
  for (const g of groups) {
    const dir = join(kit, g.sub);
    const files = g.order.filter((f) => existsSync(join(dir, f)));
    if (!files.length) continue;
    posts.push({
      batch: 'brand-kit',
      ord: ord++,
      day: null,
      kind: 'brand',
      title: g.title,
      dir,
      files,
      caption: readCap(dir),
      where: g.where,
      when: '',
      adSafety: 'ad_safe',
      angle: 'brand',
    });
  }
  return posts;
}

// The monthly ad-safe library (batch-month.mjs output) — newest batch only.
// Reels carry { video: mp4Path, poster } and upload as Cloudinary video.
function collectAdLibrary() {
  const libs = readdirSync(OUT)
    .filter((d) => /^ad-library-\d{4}-\d{2}$/.test(d))
    .sort();
  const latest = libs[libs.length - 1];
  if (!latest) return [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(OUT, latest, 'manifest.json'), 'utf8'));
  } catch {
    return [];
  }
  return manifest.entries.map((e) => ({
    batch: latest,
    ord: e.ord,
    day: null,
    kind: e.angle,
    title: e.title,
    dir: join(OUT, latest, e.dir),
    files: e.format === 'carousel' ? e.slides : [e.poster],
    video: e.format === 'reel' ? e.mp4 : null,
    caption: e.caption,
    where: e.format === 'reel' ? 'Reels · TikTok' : 'IG feed · TikTok photo',
    when: '',
    adSafety: 'ad_safe',
    angle: e.angle,
    music: e.music,
  }));
}

// The always-available boostable set — the brand looks + web hero, franchise-free.
function collectAdToolkit() {
  const posts = [];
  let ord = 1;
  const brandDir = join(OUT, 'ad-brand');
  for (const style of BRAND_STYLES) {
    const files = RATIOS.map((r) => `${style}-${r}.png`).filter((f) =>
      existsSync(join(brandDir, f)),
    );
    if (!files.length) continue;
    posts.push({
      batch: 'ad-toolkit',
      ord: ord++,
      day: null,
      kind: 'brand',
      title: `Brand — ${cap(style)}`,
      dir: brandDir,
      files,
      caption: readCap(brandDir),
      where: 'IG feed · X',
      when: '11:00–13:00',
      adSafety: 'ad_safe',
    });
  }
  const heroDir = join(OUT, 'ad-web-hero');
  const heroFiles = slides(heroDir);
  if (heroFiles.length) {
    const ordered = heroFiles
      .slice()
      .sort((a, b) => (b.includes('og') ? 1 : 0) - (a.includes('og') ? 1 : 0));
    posts.push({
      batch: 'ad-toolkit',
      ord: ord++,
      day: null,
      kind: 'brand',
      title: 'Website hero + OG card',
      dir: heroDir,
      files: ordered,
      caption: readCap(heroDir),
      where: 'Landing · share card',
      when: '',
      adSafety: 'ad_safe',
    });
  }
  return posts;
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  // --batch <name>: publish only one batch (e.g. brand-kit) without re-uploading the rest.
  const onlyBatch = process.argv.includes('--batch')
    ? process.argv[process.argv.indexOf('--batch') + 1]
    : null;
  const E = env();
  let posts = collect();
  if (onlyBatch) posts = posts.filter((p) => p.batch === onlyBatch);
  if (!posts.length) {
    console.error('Nothing to publish — generate the launch pack / a week first.');
    process.exit(1);
  }
  console.log(
    `Publishing ${posts.length} posts (${[...new Set(posts.map((p) => p.batch))].join(', ')})`,
  );
  if (dry) {
    for (const p of posts)
      console.log(`  ${p.batch} #${p.ord} ${p.title} — ${p.files.length} slide(s)`);
    return;
  }

  cloudinary.config({
    cloud_name: E.CLOUDINARY_CLOUD_NAME,
    api_key: E.CLOUDINARY_API_KEY,
    api_secret: E.CLOUDINARY_API_SECRET,
  });

  const rows = [];
  for (const p of posts) {
    const urls = [];
    for (const f of p.files) {
      const publicId = `mythique/social/${p.batch}/${p.ord}-${f.replace(/\.png$/, '')}`;
      const r = await cloudinary.uploader.upload(join(p.dir, f), {
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
      });
      urls.push(r.secure_url);
      process.stdout.write('.');
    }
    let videoUrl = null;
    if (p.video) {
      const vid = await cloudinary.uploader.upload(join(p.dir, p.video), {
        public_id: `mythique/social/${p.batch}/${p.ord}-reel`,
        overwrite: true,
        resource_type: 'video',
      });
      videoUrl = vid.secure_url;
      process.stdout.write('▶');
    }
    rows.push({
      batch: p.batch,
      ord: p.ord,
      day: p.day,
      kind: p.kind,
      title: p.title,
      image_url: urls[0],
      slide_urls: urls,
      caption: p.caption,
      guide_where: p.where,
      guide_when: p.when,
      guide_music: p.music ?? suggestMusic(p.kind, p.title),
      // Set at collection time: organic studio carousels are 'organic'; the
      // ads pipeline (weeks + brand toolkit + monthly library) is franchise-free 'ad_safe'.
      ad_safety: p.adSafety ?? 'organic',
      media_type: p.video ? 'video' : 'image',
      video_url: videoUrl,
      angle: p.angle ?? null,
    });
  }
  console.log('\nImages uploaded. Upserting rows…');

  const res = await fetch(
    `${E.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/social_posts?on_conflict=batch,ord`,
    {
      method: 'POST',
      headers: {
        apikey: E.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    console.error(`Upsert failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Published ${rows.length} posts → command center › Social.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
