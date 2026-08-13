// Design-audit capture: walk every command-center lane+sub at mobile (390) and
// desktop (1440), full-page screenshot + horizontal-overflow report, into a
// dated snapshot folder (history/YYYY-MM-DD/). Snapshots build a Mobbin-style
// living history of how the admin flows evolve — commit a folder whenever a
// design pass lands, and diff any two dates by eye.
//
// Usage:
//   MYTHIQUE_AUDIT_EMAIL=… MYTHIQUE_AUDIT_PASSWORD=… node scripts/design-audit/capture.mjs
//
// Env:
//   MYTHIQUE_AUDIT_EMAIL / MYTHIQUE_AUDIT_PASSWORD  admin login (required)
//   AUDIT_BASE_URL   target origin           (default https://mythique.app)
//   AUDIT_VIEWPORT   'mobile' | 'desktop'    (default both)
//   AUDIT_VIEWS      comma list of tab[.sub] to capture, e.g. 'command,publish.promote'
//   AUDIT_SETTLE_MS  per-page settle time    (default 10000 — admin queries are slow)
//   PW_CHROME        explicit Chrome binary  (default: playwright 'chrome' channel)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const EMAIL = process.env.MYTHIQUE_AUDIT_EMAIL;
const PASS = process.env.MYTHIQUE_AUDIT_PASSWORD;
if (!EMAIL || !PASS) {
  console.error('Set MYTHIQUE_AUDIT_EMAIL and MYTHIQUE_AUDIT_PASSWORD (an admin login).');
  process.exit(1);
}
const BASE = process.env.AUDIT_BASE_URL ?? 'https://mythique.app';
const SETTLE = Number(process.env.AUDIT_SETTLE_MS ?? 10000);

const here = dirname(fileURLToPath(import.meta.url));
const stamp = new Date().toISOString().slice(0, 10);
const OUT = join(here, 'history', stamp);
mkdirSync(OUT, { recursive: true });

// Every lane + sub-lane in the command center. Keep in sync with the DOMAINS
// registry in src/components/admin/health/format.ts when lanes are added.
const ALL_VIEWS = [
  ['command', null],
  ['catalog', 'coverage'], ['catalog', 'distributions'], ['catalog', 'hygiene'], ['catalog', 'sources'],
  ['pipelines', 'add'], ['pipelines', 'enrich'], ['pipelines', 'generate'],
  ['pipelines', 'activity'], ['pipelines', 'runs'], ['pipelines', 'spend'],
  ['inbox', 'reports'], ['inbox', 'review'], ['inbox', 'comicvine'],
  ['audience', 'traffic'], ['audience', 'acquisition'], ['audience', 'community'], ['audience', 'errors'],
  ['publish', 'social'], ['publish', 'promote'], ['publish', 'insights'],
  ['publish', 'campaigns'], ['publish', 'debate'], ['publish', 'og'],
];
const wanted = process.env.AUDIT_VIEWS?.split(',').map((s) => s.trim());
const VIEWS = wanted
  ? ALL_VIEWS.filter(([t, s]) => wanted.includes(s ? `${t}.${s}` : t))
  : ALL_VIEWS;

const ALL_VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];
const VIEWPORTS = process.env.AUDIT_VIEWPORT
  ? ALL_VIEWPORTS.filter((v) => v.name === process.env.AUDIT_VIEWPORT)
  : ALL_VIEWPORTS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'chrome' }),
  args: ['--no-sandbox'],
});

// Log in once, reuse the storage state for every viewport.
const loginCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const lp = await loginCtx.newPage();
await lp.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await lp.waitForSelector('input[aria-label="Email address"]', { timeout: 20000 });
await lp.fill('input[aria-label="Email address"]', EMAIL);
await lp.fill('input[aria-label="Password"]', PASS);
await lp.getByText('Sign In', { exact: true }).click();
await lp.waitForURL('**/explore', { timeout: 25000 });
const state = await loginCtx.storageState();
await loginCtx.close();
console.log(`login OK → capturing ${VIEWS.length} views × ${VIEWPORTS.length} viewports to ${OUT}`);

const report = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    storageState: state,
  });
  const page = await ctx.newPage();
  for (const [tab, sub] of VIEWS) {
    const url = `${BASE}/admin/health?tab=${tab}${sub ? `&sub=${sub}` : ''}`;
    const key = `${vp.name}-${tab}${sub ? `-${sub}` : ''}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(SETTLE);
      const metrics = await page.evaluate(() => {
        const iw = window.innerWidth;
        const sw = document.documentElement.scrollWidth;
        const offenders = [];
        if (sw > iw + 1) {
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > iw + 2 || r.left < -2) && el.children.length < 8) {
              offenders.push({
                tag: el.tagName,
                text: (el.textContent || '').trim().slice(0, 40),
                w: Math.round(r.width),
                right: Math.round(r.right),
              });
              if (offenders.length >= 4) break;
            }
          }
        }
        return { iw, sw, docH: document.documentElement.scrollHeight, offenders };
      });
      // Cap absurdly tall full-page shots (keeps files reviewable).
      await page.screenshot({ path: join(OUT, `${key}.png`), fullPage: metrics.docH < 6000 });
      report.push({ key, url, ...metrics, hOverflow: metrics.sw > metrics.iw + 1 });
      console.log(
        `${metrics.sw > metrics.iw + 1 ? 'OVERFLOW' : 'ok      '} ${key} (${metrics.sw}/${metrics.iw}w, ${metrics.docH}h)`,
      );
    } catch (e) {
      report.push({ key, url, error: String(e?.message ?? e) });
      console.log(`ERROR    ${key}: ${e?.message ?? e}`);
    }
  }
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

const overflows = report.filter((r) => r.hOverflow);
console.log('\n=== overflow summary ===');
for (const r of overflows) console.log(`${r.key}: scrollW ${r.sw} vs ${r.iw}`, JSON.stringify(r.offenders));
if (!overflows.length) console.log('none — every view fits its viewport');
console.log(`\ncaptured ${report.filter((r) => !r.error).length}/${report.length} views to ${OUT}`);
process.exit(overflows.length || report.some((r) => r.error) ? 1 : 0);
