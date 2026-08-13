// E2E smoke over the DEPLOYED web app — the ~10 read-only flows a real visitor
// hits, driven in a real Chrome via playwright-core (already a devDependency;
// same launch pattern as scripts/social/lib.mjs). No auth, no writes beyond the
// page_views/attribution beacons any visitor fires.
//
// Why this exists: the 2026-07-15 bug hunt found the browse grid had been
// silently broken (multi-tag filter timing out, search chars 400ing) — failures
// only a real navigation exercises. This suite is the tripwire.
//
//   BASE_URL=https://mythique.app node scripts/smoke/e2e-smoke.mjs
//
// Exit 0 = all flows passed; exit 1 = failures (listed). Each flow gets a hard
// timeout so one hung page can't wedge the run. PW_CHROME overrides the Chrome
// binary (CI uses the runner's preinstalled Chrome via channel:'chrome').
import { chromium } from 'playwright-core';

const BASE = (process.env.BASE_URL || 'https://mythique.app').replace(/\/$/, '');
const NAV_TIMEOUT = 30_000;
const FLOW_TIMEOUT = 45_000;

/** Wait until the page's body text contains `needle` (case-insensitive). */
async function seeText(page, needle, timeout = 15_000) {
  await page.waitForFunction(
    (n) => document.body && document.body.innerText.toLowerCase().includes(n),
    needle.toLowerCase(),
    { timeout },
  );
}

/**
 * GET a URL as a named bot. No browser: the crawler surface is server-rendered
 * HTML by definition, and every flow here needs a DIFFERENT user-agent, which
 * the shared browser context cannot give it.
 */
async function fetchAs(path, userAgent) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'user-agent': userAgent },
    redirect: 'follow',
  });
  const body = await res.text();
  return { status: res.status, body };
}

const titleOf = (html) => (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
const ogTitleOf = (html) =>
  html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '';

const flows = [
  {
    name: 'landing renders',
    run: async (page) => {
      const res = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
      await seeText(page, 'mythique');
    },
  },
  {
    name: 'explore feed renders hero rows',
    run: async (page) => {
      await page.goto(`${BASE}/explore`, { waitUntil: 'domcontentloaded' });
      // The dark stage always leads with a spotlight + browse pods.
      await seeText(page, 'browse', 20_000);
    },
  },
  {
    name: 'search finds Batman',
    run: async (page) => {
      await page.goto(`${BASE}/search?q=batman`, { waitUntil: 'domcontentloaded' });
      await seeText(page, 'batman', 20_000);
    },
  },
  {
    name: 'category grid renders (marvel)',
    run: async (page) => {
      await page.goto(`${BASE}/category/marvel`, { waitUntil: 'domcontentloaded' });
      // Grid + count line ("N characters") prove the browse query ran —
      // the surface the 2026-07-15 filter bugs silently broke.
      await seeText(page, 'characters', 20_000);
    },
  },
  {
    name: 'character page renders (Spider-Man)',
    run: async (page) => {
      await page.goto(`${BASE}/character/620`, { waitUntil: 'domcontentloaded' });
      await seeText(page, 'spider-man', 20_000);
      await seeText(page, 'power', 20_000); // Power Profile section
    },
  },
  {
    name: 'compare verdict page renders (Spider-Man vs Batman)',
    run: async (page) => {
      await page.goto(`${BASE}/compare/620/69`, { waitUntil: 'domcontentloaded' });
      await seeText(page, 'spider-man', 25_000);
      await seeText(page, 'batman', 25_000);
    },
  },
  {
    name: 'versus hub shows a daily matchup',
    run: async (page) => {
      await page.goto(`${BASE}/versus`, { waitUntil: 'domcontentloaded' });
      await seeText(page, 'vs', 20_000);
    },
  },
  {
    name: 'daily game loads',
    run: async (page) => {
      await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
      await seeText(page, 'guess', 20_000);
    },
  },
  {
    name: 'sitemap index is served',
    run: async (page) => {
      const res = await page.goto(`${BASE}/sitemap.xml`, { waitUntil: 'domcontentloaded' });
      if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
      const body = await res.text();
      if (!/sitemapindex|urlset/.test(body)) throw new Error('no sitemap markup in response');
    },
  },
  {
    name: 'PWA assets are served (manifest + service worker)',
    run: async (page) => {
      for (const path of ['/manifest.json', '/sw.js']) {
        const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
        if (!res.ok()) throw new Error(`${path}: HTTP ${res.status()}`);
      }
    },
  },
  // --- the crawler surface -------------------------------------------------
  // Added 2026-07-27, after every Node serverless function was found dead in
  // production — bot-page, share-meta and battle all returning
  // FUNCTION_INVOCATION_FAILED at cold start, from 2026-07-14 until it was
  // noticed by accident thirteen days later.
  //
  // Nothing above catches it, and a status check alone would not have either:
  // the user-agent rewrites in vercel.json simply do not fire when the function
  // is down, so a crawler falls through to the SPA shell and gets a cheerful
  // 200 with the generic site title. The assertion has to be that the page is
  // the RIGHT page, not that the request succeeded.
  {
    name: 'api functions are alive (cold start)',
    run: async () => {
      // No query on purpose: these paths return a 404 page without touching the
      // database, so a 5xx here can only be a module-load crash at cold start.
      for (const path of ['/api/bot-page', '/api/share-meta']) {
        const { status } = await fetchAs(path, 'MythiqueSmoke/1.0');
        if (status >= 500) throw new Error(`${path}: HTTP ${status} — function failed to start`);
      }
    },
  },
  {
    name: 'search crawlers get the rendered character page',
    run: async () => {
      const { status, body } = await fetchAs('/character/620', 'Googlebot/2.1');
      if (status !== 200) throw new Error(`HTTP ${status}`);
      const title = titleOf(body);
      // The bot page titles itself "<name> — Powers, Stats, Allies & Enemies";
      // the SPA shell says "Mythique — Every universe. Every icon." Getting the
      // shell means the catalogue is invisible to search.
      if (!/powers, stats/i.test(title)) {
        throw new Error(`served the SPA shell, not the bot page (title: "${title}")`);
      }
    },
  },
  {
    name: 'social previews unfurl with the character, not the site',
    run: async () => {
      const { status, body } = await fetchAs('/character/620', 'Twitterbot/1.0');
      if (status !== 200) throw new Error(`HTTP ${status}`);
      const og = ogTitleOf(body);
      if (!/spider-man/i.test(og)) {
        throw new Error(`generic unfurl — og:title was "${og}"`);
      }
    },
  },
];

async function launchChrome() {
  const opts = process.env.PW_CHROME
    ? { executablePath: process.env.PW_CHROME }
    : { channel: 'chrome' };
  return chromium.launch({ ...opts, args: ['--no-sandbox'] });
}

const browser = await launchChrome();
const failures = [];

for (const flow of flows) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 MythiqueSmoke/1.0',
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  const started = Date.now();
  try {
    await Promise.race([
      flow.run(page),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`flow timeout (${FLOW_TIMEOUT}ms)`)), FLOW_TIMEOUT),
      ),
    ]);
    console.log(`ok   ${flow.name} (${Date.now() - started}ms)`);
  } catch (e) {
    failures.push(`${flow.name}: ${e?.message ?? e}`);
    console.error(`FAIL ${flow.name} (${Date.now() - started}ms): ${e?.message ?? e}`);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length > 0) {
  console.error(`\n${failures.length}/${flows.length} smoke flows FAILED against ${BASE}:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nAll ${flows.length} smoke flows passed against ${BASE}.`);
