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
const BASE_URL = (process.env.SITEMAP_BASE_URL || 'https://mythique.app').replace(/\/$/, '');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

const OUT_DIR = 'dist';
const SITEMAP_DIR = join(OUT_DIR, 'sitemaps');
const PAGE_SIZE = 1000; // PostgREST default cap
const URLS_PER_FILE = 40_000; // under the 50k-per-sitemap limit, with headroom

// Franchise pages thinner than this (member count) are skipped — a 1–2 hero
// franchise page has too little unique content to be worth indexing.
const MIN_FRANCHISE_HEROES = 3;
// Curated matchup coverage: the top N popular heroes × their top K rivals →
// /compare pages. Bounded so the RPC fan-out and URL count stay sane; the rest
// of the matchup space stays discoverable via in-page "who wins?" links.
const MATCHUP_HEROES = 150;
const MATCHUP_PER_HERO = 5;
const MATCHUP_CONCURRENCY = 6;

// Static, hand-maintained routes (priority + changefreq matter for these).
const STATIC_ROUTES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/explore', changefreq: 'daily', priority: '0.9' },
  { loc: '/play', changefreq: 'daily', priority: '0.9' },
  { loc: '/search', changefreq: 'weekly', priority: '0.7' },
  // The index the per-house pages hang off, so a crawler reaching /house/<slug>
  // from houses.xml can also see the set they belong to.
  { loc: '/house', changefreq: 'weekly', priority: '0.6' },
  // Same job for events. It matters more here than for houses, because /event
  // has no inbound link anywhere in the app either — without this entry the
  // whole events tree is reachable only by typing a URL.
  { loc: '/event', changefreq: 'daily', priority: '0.6' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
];

// Registered universe (publisher/studio) slugs — mirrors the slug set of
// UNIVERSE_BRANDS in src/constants/universeBrands.ts (this standalone build
// script can't import TS). These are the canonical /universe/<slug> URLs the app
// and the crawler bot pages both link to; unregistered universes stay
// discoverable via character-page links rather than the sitemap.
// __tests__/constants/universeBrands.test.ts guards this list against drift.
const UNIVERSE_SLUGS = [
  'marvel',
  'dc',
  'dark-horse',
  'star-wars',
  'image',
  'walking-dead',
  'netherrealm',
  'babylon-5',
  'avatar-last-airbender',
  'snk',
  'the-boys',
  'sin-city',
  'pokemon',
  'gatchaman',
  'hanna-barbera',
  'looney-tunes',
  'cd-projekt-red',
  'rocky-bullwinkle',
  'insomniac',
  'star-trek',
  'green-hornet',
  'tmnt',
  'conan',
  'ben-10',
  'buffy',
  'harvey',
  'terminator',
  'bungie',
  'crystal-dynamics',
  'playstation-studios',
  'xbox-game-studios',
  'god-of-war',
  'halo',
  'santa-monica-studio',
  'namco',
  'radical-entertainment',
  'alien',
  'predator',
  'indiana-jones',
  'jurassic-park',
  'nintendo',
  'shueisha',
  'warp-graphics',
  'archie',
  'disney',
  'valiant',
  'top-cow',
  'malibu',
  'rebellion',
  'capcom',
  'sega',
  'mattel',
  'hasbro',
  'kodansha',
  'warner-bros',
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
  'magic',
  'aliens',
  'mythology',
];

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlEntry({ loc, changefreq, priority, images }) {
  const parts = [`    <loc>${xmlEscape(BASE_URL + loc)}</loc>`];
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  // Image extension (Google Images): image locs are absolute CDN URLs, so they
  // are NOT prefixed with BASE_URL. Surfaces the hero-portrait catalogue in the
  // Images vertical — a real traffic channel for a visual encyclopedia.
  if (images && images.length) {
    for (const img of images) {
      parts.push(
        `    <image:image>\n      <image:loc>${xmlEscape(img)}</image:loc>\n    </image:image>`,
      );
    }
  }
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

function urlSet(entries, { images = false } = {}) {
  const imageNs = images ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>\n` +
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

// Page through a PostgREST table, returning full rows for `select`. Throws on a
// non-OK response so the caller can decide to fail-soft. `order` must be a valid
// PostgREST order expression (keyset paging relies on a stable sort).
async function fetchRows(table, select, query = '', order = 'id') {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url =
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}${query ? `&${query}` : ''}` +
      `&order=${order}&limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`${table} fetch ${res.status}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

// Page through a table returning every id (thin wrapper over fetchRows).
async function fetchIds(table, query = '') {
  return (await fetchRows(table, 'id', query)).map((r) => r.id);
}

// A hero's top related heroes of one kind (enemy/ally/teammate) via the same RPC
// the app and bot pages use. Fail-soft to [] so one hero can't break the batch.
async function fetchRelated(heroId, kind, limit) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_related_heroes`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_hero_id: heroId,
        p_kind: kind,
        p_limit: limit,
        p_same_universe: false,
      }),
    });
    if (!res.ok) return [];
    return (await res.json()).filter((r) => r && r.id);
  } catch {
    return [];
  }
}

// Run async `fn` over `items` with bounded concurrency — keeps the matchup RPC
// fan-out fast without hammering PostgREST with hundreds of parallel requests.
async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

// Emit one or more chunked child sitemaps from pre-built entries; returns the
// filenames written so they can be added to the index. `images` toggles the
// Google image-sitemap namespace on the urlset.
async function writeEntriesChunked(name, entries, { images = false } = {}) {
  const files = [];
  for (let i = 0; i < entries.length; i += URLS_PER_FILE) {
    const slice = entries.slice(i, i + URLS_PER_FILE);
    const file =
      entries.length > URLS_PER_FILE ? `${name}-${i / URLS_PER_FILE + 1}.xml` : `${name}.xml`;
    await writeFile(join(SITEMAP_DIR, file), urlSet(slice, { images }), 'utf8');
    files.push(file);
  }
  return files;
}

// Chunked child sitemaps for a route prefix over a list of ids.
async function writeChunked(name, prefix, ids) {
  const entries = ids.map((id) => ({
    loc: `${prefix}/${encodeURIComponent(String(id))}`,
    changefreq: 'weekly',
  }));
  return writeEntriesChunked(name, entries);
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
  await writeFile(
    join(SITEMAP_DIR, 'universes.xml'),
    urlSet(UNIVERSE_SLUGS.map((slug) => ({ loc: `/universe/${slug}`, changefreq: 'weekly' }))),
    'utf8',
  );
  indexFiles.push('universes.xml');

  // Dynamic content — each source is independently fail-soft so one Supabase
  // blip can't wipe the others (or break the deploy).
  if (SUPABASE_URL && SUPABASE_KEY) {
    // Houses. Small and curated, but these are the pages built to be found:
    // "House Targaryen family tree" is a query people actually type, which is
    // the reason the tree got a URL of its own.
    try {
      const rows = await fetchRows('houses', 'slug');
      await writeFile(
        join(SITEMAP_DIR, 'houses.xml'),
        urlSet(
          rows.map((h) => ({
            loc: `/house/${encodeURIComponent(String(h.slug))}`,
            changefreq: 'weekly',
          })),
        ),
        'utf8',
      );
      indexFiles.push('houses.xml');
    } catch (err) {
      console.warn('[sitemap] houses skipped:', err?.message ?? err);
    }

    // Events: the series hubs, and every frozen EDITION.
    //
    // The editions are the point. A hub is "D23" and changes meaning every
    // August; an edition is "D23 2026" and never does, which is the only kind of
    // URL that can hold a ranking for a year-qualified query — and "what
    // happened at d23 2026" is a query with real intent behind it.
    //
    // Editions are `never` changefreq because a frozen snapshot genuinely does
    // not change; the recomputed half improves as enrichment lands, but not on a
    // cadence worth advertising to a crawler.
    // Hubs are derived from the editions rather than read from watched_events:
    // that table has RLS enabled with deliberately NO policies (the app reads it
    // only through security-definer RPCs), so an anon fetch here would return
    // zero rows and silently emit an events file with nothing in it. Deriving is
    // also the more correct list — a watched event with no editions yet is an
    // empty page, and advertising it to a crawler is worse than omitting it.
    try {
      const editions = await fetchRows('event_editions', 'slug,edition_slug', '', 'slug');
      const hubs = [...new Set(editions.map((e) => String(e.slug)))];
      await writeFile(
        join(SITEMAP_DIR, 'events.xml'),
        urlSet([
          ...hubs.map((slug) => ({
            loc: `/event/${encodeURIComponent(slug)}`,
            changefreq: 'daily',
          })),
          ...editions.map((e) => ({
            loc: `/event/${encodeURIComponent(String(e.slug))}/${encodeURIComponent(
              String(e.edition_slug),
            )}`,
            changefreq: 'never',
          })),
        ]),
        'utf8',
      );
      indexFiles.push('events.xml');
    } catch (err) {
      console.warn('[sitemap] events skipped:', err?.message ?? err);
    }

    // Characters, WITH portrait images for the Google Images vertical. Quality
    // gate: only heroes with real content (a summary) — ~16k of 34k.
    try {
      const rows = await fetchRows('heroes', 'id,portrait_url,image_url', 'summary=not.is.null');
      const entries = rows.map((h) => {
        const img = h.portrait_url || h.image_url;
        return {
          loc: `/character/${encodeURIComponent(String(h.id))}`,
          changefreq: 'weekly',
          images: img ? [img] : undefined,
        };
      });
      const written = await writeEntriesChunked('characters', entries, { images: true });
      indexFiles.push(...written);
      console.log(`[sitemap] characters: ${entries.length} urls → ${written.join(', ')}`);
    } catch (err) {
      console.error(`[sitemap] characters failed: ${err.message}`);
    }

    // Titles + teams (id-based, no images).
    for (const [name, prefix, table, q] of [
      ['titles', '/title', 'titles', ''],
      ['teams', '/team', 'teams', ''],
    ]) {
      try {
        const ids = await fetchIds(table, q);
        const written = await writeChunked(name, prefix, ids);
        indexFiles.push(...written);
        console.log(`[sitemap] ${name}: ${ids.length} urls → ${written.join(', ')}`);
      } catch (err) {
        console.error(`[sitemap] ${name} failed: ${err.message}`);
      }
    }

    // Franchises: distinct `franchise` values with enough members to be worth a
    // page. Canonical is the encoded raw name, matching /franchise/[slug].
    try {
      const rows = await fetchRows('heroes', 'franchise', 'franchise=not.is.null', 'franchise');
      const counts = new Map();
      for (const r of rows) {
        if (r.franchise) counts.set(r.franchise, (counts.get(r.franchise) ?? 0) + 1);
      }
      const franchises = [...counts.entries()]
        .filter(([, n]) => n >= MIN_FRANCHISE_HEROES)
        .map(([f]) => f)
        .sort();
      const entries = franchises.map((f) => ({
        loc: `/franchise/${encodeURIComponent(f)}`,
        changefreq: 'weekly',
      }));
      const written = await writeEntriesChunked('franchises', entries);
      indexFiles.push(...written);
      console.log(`[sitemap] franchises: ${entries.length} urls → ${written.join(', ')}`);
    } catch (err) {
      console.error(`[sitemap] franchises failed: ${err.message}`);
    }

    // Matchups: top popular heroes × their top rivals → /compare pages. This is
    // content unique to Mythique ("X vs Y who would win"). URLs use the same
    // sorted-id canonical the bot page emits, and are deduped across heroes.
    try {
      const popular = await fetchRows(
        'heroes',
        'id',
        'category=eq.popular',
        'fame_score.desc.nullslast',
      );
      const top = popular.slice(0, MATCHUP_HEROES);
      const seen = new Set();
      const entries = [];
      const rivalLists = await mapLimit(top, MATCHUP_CONCURRENCY, (h) =>
        fetchRelated(h.id, 'enemy', MATCHUP_PER_HERO).then((rivals) => ({ id: h.id, rivals })),
      );
      for (const { id, rivals } of rivalLists) {
        for (const rival of rivals) {
          const [x, y] = [String(id), String(rival.id)].sort();
          if (x === y) continue;
          const key = `${x}|${y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          entries.push({
            loc: `/compare/${encodeURIComponent(x)}/${encodeURIComponent(y)}`,
            changefreq: 'monthly',
          });
        }
      }
      const written = await writeEntriesChunked('matchups', entries);
      indexFiles.push(...written);
      console.log(`[sitemap] matchups: ${entries.length} urls → ${written.join(', ')}`);
    } catch (err) {
      console.error(`[sitemap] matchups failed: ${err.message}`);
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
