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
import pw from 'playwright-core';

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
];

async function launchChrome() {
  const opts = process.env.PW_CHROME
    ? { executablePath: process.env.PW_CHROME }
    : { channel: 'chrome' };
  return pw.chromium.launch({ ...opts, args: ['--no-sandbox'] });
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
