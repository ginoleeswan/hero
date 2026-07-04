// Build-time sitemap generator. Runs after `expo export -p web` (see
// vercel.json buildCommand) and writes a sitemap index + chunked child
// sitemaps into the export output (dist/), so the ~22k deep content pages
// (heroes, titles, teams) are discoverable — the app only links a fraction of
// them. Static pages stay enumerated by hand here.
//
// Fail-soft by design: if Supabase env/creds are missing or a fetch fails, we
// still emit the static + category sitemap and exit 0, so a sitemap hiccup
// never breaks a deploy.
//
// Data is read with the public anon key over PostgREST — the same read path the
// app uses — so only anon-readable rows are ever listed.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Mirrors SITE_URL in src/constants/site.ts (this standalone build script can't
// import TS). Override at build time with SITEMAP_BASE_URL. Keep in sync with
// SITE_URL if the origin ever changes.
const BASE_URL = (process.env.SITEMAP_BASE_URL || 'https://mythique.app').replace(
  /\/$/,
  '',
);
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

const OUT_DIR = 'dist';
const SITEMAP_DIR = join(OUT_DIR, 'sitemaps');
const PAGE_SIZE = 1000; // PostgREST default cap
const URLS_PER_FILE = 40_000; // under the 50k-per-sitemap limit, with headroom

// Static, hand-maintained routes (priority + changefreq matter for these).
const STATIC_ROUTES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/explore', changefreq: 'daily', priority: '0.9' },
  { loc: '/play', changefreq: 'daily', priority: '0.9' },
  { loc: '/search', changefreq: 'weekly', priority: '0.7' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
];

// Fixed category taxonomy — mirrors CategorySlug in src/lib/db/heroes/types.ts.
const CATEGORY_SLUGS = [
  'popular',
  'villain',
  'xmen',
  'anti-heroes',
  'marvel',
  'dc',
  'image',
  'dark-horse',
  'strongest',
  'most-intelligent',
  'most-iconic',
  'franchise-icons',
  'anime',
  'video-games',
  'horror',
];

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlEntry({ loc, changefreq, priority }) {
  const parts = [`    <loc>${xmlEscape(BASE_URL + loc)}</loc>`];
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

function urlSet(entries) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map(urlEntry).join('\n') +
    '\n</urlset>\n'
  );
}

function sitemapIndex(files) {
  const lastmod = new Date().toISOString();
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    files
      .map(
        (f) =>
          `  <sitemap>\n    <loc>${xmlEscape(`${BASE_URL}/sitemaps/${f}`)}</loc>\n` +
          `    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
      )
      .join('\n') +
    '\n</sitemapindex>\n'
  );
}

// Page through a PostgREST table, returning every id. Throws on a non-OK
// response so the caller can decide to fail-soft.
async function fetchIds(table, query = '') {
  const ids = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url =
      `${SUPABASE_URL}/rest/v1/${table}?select=id${query ? `&${query}` : ''}` +
      `&order=id&limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`${table} fetch ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    for (const r of rows) ids.push(r.id);
    if (rows.length < PAGE_SIZE) break;
  }
  return ids;
}

// Emit one or more chunked child sitemaps for a route prefix; returns the
// filenames written so they can be added to the index.
async function writeChunked(name, prefix, ids) {
  const files = [];
  for (let i = 0; i < ids.length; i += URLS_PER_FILE) {
    const slice = ids.slice(i, i + URLS_PER_FILE);
    const file =
      ids.length > URLS_PER_FILE ? `${name}-${i / URLS_PER_FILE + 1}.xml` : `${name}.xml`;
    const entries = slice.map((id) => ({
      loc: `${prefix}/${encodeURIComponent(String(id))}`,
      changefreq: 'weekly',
    }));
    await writeFile(join(SITEMAP_DIR, file), urlSet(entries), 'utf8');
    files.push(file);
  }
  return files;
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    console.error(`[sitemap] ${OUT_DIR}/ not found — run after \`expo export -p web\`. Skipping.`);
    return;
  }
  await rm(SITEMAP_DIR, { recursive: true, force: true });
  await mkdir(SITEMAP_DIR, { recursive: true });

  const indexFiles = [];

  // Static + categories always succeed (no network).
  await writeFile(join(SITEMAP_DIR, 'core.xml'), urlSet(STATIC_ROUTES), 'utf8');
  indexFiles.push('core.xml');
  await writeFile(
    join(SITEMAP_DIR, 'categories.xml'),
    urlSet(CATEGORY_SLUGS.map((slug) => ({ loc: `/category/${slug}`, changefreq: 'weekly' }))),
    'utf8',
  );
  indexFiles.push('categories.xml');

  // Dynamic content — fail-soft so a Supabase blip can't break the deploy.
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const sources = [
        // Quality gate: only heroes with real content (a summary) — ~16k of 34k.
        ['characters', '/character', 'heroes', 'summary=not.is.null'],
        ['titles', '/title', 'titles', ''],
        ['teams', '/team', 'teams', ''],
      ];
      for (const [name, prefix, table, q] of sources) {
        const ids = await fetchIds(table, q);
        const written = await writeChunked(name, prefix, ids);
        indexFiles.push(...written);
        console.log(`[sitemap] ${name}: ${ids.length} urls → ${written.join(', ')}`);
      }
    } catch (err) {
      console.error(`[sitemap] dynamic generation failed, keeping static only: ${err.message}`);
    }
  } else {
    console.warn('[sitemap] EXPO_PUBLIC_SUPABASE_URL/KEY not set — static sitemap only.');
  }

  await writeFile(join(OUT_DIR, 'sitemap.xml'), sitemapIndex(indexFiles), 'utf8');
  console.log(`[sitemap] wrote ${OUT_DIR}/sitemap.xml index → ${indexFiles.length} child sitemaps`);

  // Emit robots.txt from the same BASE_URL so its Sitemap directive can never
  // drift from the sitemap we just wrote.
  const robots = `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${BASE_URL}/sitemap.xml\n`;
  await writeFile(join(OUT_DIR, 'robots.txt'), robots, 'utf8');
  console.log(`[sitemap] wrote ${OUT_DIR}/robots.txt`);
}

main().catch((err) => {
  // Never fail the build over the sitemap.
  console.error(`[sitemap] unexpected error: ${err.stack || err.message}`);
});
