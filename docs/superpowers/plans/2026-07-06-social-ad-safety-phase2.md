# Social Ad Safety — Phase 2 (Ad Generators) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the data-first paid-ad creative pipeline on top of the Phase 1 safety layer: a parametric brand shell, a zero-dependency stylization utility, the `safePortrait` choke point, and four bespoke ad generators — with a visual checkpoint after the first template.

**Architecture:** `ads/stylize.mjs` (pure CSS/SVG filter helpers) and `ads/shell.mjs` (parametric `{w,h}` brand shell + disclaimer) are shared support. `safePortrait` (+ pure `portraitPlan`) is added to `safety.mjs` as the imagery choke point — ad context never uses official art. Four generators in `ads/` compose these into paid creative, drawing selection from `safePool`.

**Tech Stack:** Node ESM `.mjs`, `node:test`, existing `lib.mjs` render helpers (Playwright/Chrome — already a dependency). Zero new dependencies.

## Global Constraints

- **Node ESM only**; **zero new dependencies**; **public anon key only** (via `lib.mjs`).
- **Ad context NEVER uses `image_url`/`image_md_url`** — only the Mythique render (`portrait_url`) or nothing. This is a hard, tested invariant.
- **Every ad slide carries the disclaimer footer** with the verbatim copy: `Unofficial fan encyclopedia. Characters © their respective owners.`
- **Data-first posture:** faces are absent by default; a face appears only per `adImagery(hero)` (Tier C full, Tier A/B stylized, Tier S never).
- **Tests run with:** `yarn test:social` (`node --test "scripts/social/**/*.test.mjs"`).
- **Tier risk order:** `S > A > B > C`.

---

### Task 1: `ads/stylize.mjs` — pure CSS/SVG filter helpers

**Files:**
- Create: `scripts/social/ads/stylize.mjs`
- Create: `scripts/social/ads/stylize.test.mjs`

**Interfaces:**
- Produces:
  - `STYLES: string[]` — `['duotone','poster','halftone']`
  - `svgFilterDefs() => string` — one inline `<svg>` block defining all filters (inject once per page).
  - `styleAttr(style) => string` — inline CSS applying the filter, e.g. `filter:url(#mq-duotone);`.

- [ ] **Step 1: Write the failing test**

Create `scripts/social/ads/stylize.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, svgFilterDefs, styleAttr } from './stylize.mjs';

test('STYLES lists the supported treatments', () => {
  assert.deepEqual(STYLES, ['duotone', 'poster', 'halftone']);
});

test('svgFilterDefs defines a filter per style', () => {
  const svg = svgFilterDefs();
  assert.match(svg, /<svg/);
  assert.match(svg, /id="mq-duotone"/);
  assert.match(svg, /id="mq-poster"/);
  assert.match(svg, /id="mq-halftone"/);
  assert.match(svg, /feColorMatrix|feComponentTransfer/);
});

test('styleAttr references the right filter', () => {
  assert.equal(styleAttr('duotone'), 'filter:url(#mq-duotone);');
  assert.equal(styleAttr('poster'), 'filter:url(#mq-poster);');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/social/ads/stylize.test.mjs`
Expected: FAIL — cannot resolve `./stylize.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/social/ads/stylize.mjs`:

```js
// Zero-dependency portrait stylization via inline SVG filters, applied at
// Chrome render time. Turns a raw render into a "clearly transformed graphic"
// for Tier A/B ad depiction. Brand palette: navy #06121a / gold #e0a83e.
export const STYLES = ['duotone', 'poster', 'halftone'];

// Inject once per page. Defines every filter; slides reference by id.
export function svgFilterDefs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="mq-duotone" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/>
      <feComponentTransfer>
        <feFuncR type="table" tableValues="0.024 0.878"/>
        <feFuncG type="table" tableValues="0.071 0.659"/>
        <feFuncB type="table" tableValues="0.102 0.243"/>
      </feComponentTransfer>
    </filter>
    <filter id="mq-poster" color-interpolation-filters="sRGB">
      <feComponentTransfer>
        <feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
        <feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
        <feFuncB type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
      </feComponentTransfer>
    </filter>
    <filter id="mq-halftone" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer>
    </filter>
  </defs></svg>`;
}

export function styleAttr(style) {
  return `filter:url(#mq-${style});`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/social/ads/stylize.test.mjs`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/ads/stylize.mjs scripts/social/ads/stylize.test.mjs
git commit -m "feat(social/ads): zero-dep SVG stylization filters"
```

---

### Task 2: `ads/shell.mjs` — parametric brand shell + disclaimer

**Files:**
- Create: `scripts/social/ads/shell.mjs`
- Create: `scripts/social/ads/shell.test.mjs`

**Interfaces:**
- Consumes: `COLORS`, `grainUri`, `fontFace` from `../lib.mjs`; `DISCLAIMER` from `../safety.mjs`; `svgFilterDefs` from `./stylize.mjs`.
- Produces: `adShell(F, { w, h }, inner, extra='') => string` — a full HTML doc sized `w×h`, brand background, footer wordmark + handle + disclaimer, with the stylize filter defs injected.

- [ ] **Step 1: Write the failing test**

Create `scripts/social/ads/shell.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adShell } from './shell.mjs';

const F = { R: '', F: '', FR: '', S: '' }; // fonts are base64-embedded; empty is fine for structure tests

test('adShell renders at the requested size with brand + disclaimer + inner', () => {
  const html = adShell(F, { w: 1080, h: 1080 }, '<div class="probe">hi</div>');
  assert.match(html, /width:1080px/);
  assert.match(html, /height:1080px/);
  assert.match(html, /class="probe"/);
  assert.match(html, /mythique/);
  assert.match(html, /@mythiqueapp/);
  assert.match(html, /Unofficial fan encyclopedia\. Characters © their respective owners\./);
  assert.match(html, /id="mq-duotone"/); // stylize defs injected
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/social/ads/shell.test.mjs`
Expected: FAIL — cannot resolve `./shell.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/social/ads/shell.mjs`:

```js
// Parametric {w,h} brand shell for paid ad creative. Mirrors lib.mjs's slide()
// but is size-agnostic and always carries the legal disclaimer footer.
import { COLORS, grainUri, fontFace } from '../lib.mjs';
import { DISCLAIMER } from '../safety.mjs';
import { svgFilterDefs } from './stylize.mjs';

export function adShell(F, { w, h }, inner, extra = '') {
  const { GOLD, CREAM, NAVY } = COLORS;
  const css = `${fontFace(F)}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:${NAVY};font-family:'FR';color:${CREAM};}
.page{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:radial-gradient(60% 44% at 50% 30%, rgba(224,168,62,.12), transparent 62%), radial-gradient(120% 90% at 50% 6%, #12242f, ${NAVY} 72%);}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle, rgba(224,168,62,.10) 1.3px, transparent 1.9px);background-size:30px;-webkit-mask-image:radial-gradient(130% 100% at 50% 40%, transparent 42%, #000);opacity:.5;}
.grain{position:absolute;inset:0;background-image:url("${grainUri()}");background-size:340px;opacity:.05;mix-blend-mode:overlay;}
.foot{position:absolute;bottom:${Math.round(h * 0.035)}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;opacity:.92;}
.foot .row{display:flex;align-items:center;gap:16px;}
.foot .wm{font-family:'R';font-size:${Math.round(h * 0.03)}px;color:${CREAM};}
.foot .at{font-family:'FR';font-size:${Math.round(h * 0.02)}px;color:${GOLD};letter-spacing:1px;}
.foot .disc{font-family:'S';font-size:${Math.round(h * 0.014)}px;color:rgba(245,235,220,.5);text-align:center;padding:0 40px;}
.g{color:${GOLD};}.pop{font-family:'F';-webkit-text-stroke:${Math.round(h * 0.006)}px ${NAVY};paint-order:stroke fill;}
.styl img{width:100%;height:100%;object-fit:cover;}
${extra}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${svgFilterDefs()}<div class="page"><div class="dots"></div><div class="grain"></div>${inner}<div class="foot"><div class="row"><span class="wm">mythique</span><span class="at">@mythiqueapp</span></div><div class="disc">${DISCLAIMER}</div></div></div></body></html>`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/social/ads/shell.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/ads/shell.mjs scripts/social/ads/shell.test.mjs
git commit -m "feat(social/ads): parametric brand shell with disclaimer footer"
```

---

### Task 3: `safePortrait` + pure `portraitPlan` in `safety.mjs`

**Files:**
- Modify: `scripts/social/safety.mjs`
- Modify: `scripts/social/safety.test.mjs`

**Interfaces:**
- Consumes: `imgDataUri` from `./lib.mjs`.
- Produces:
  - `portraitPlan(hero, context) => { fields: string[], stylize: boolean }` — pure. `context` is `'organic'|'ad'`.
  - `safePortrait(hero, { context }) => Promise<{ uri, stylize } | null>` — thin I/O.

- [ ] **Step 1: Write the failing test**

Append to `scripts/social/safety.test.mjs` (and add `portraitPlan` to the existing import from `./safety.mjs`):

```js
test('portraitPlan: organic uses the full fallback chain, never stylized', () => {
  assert.deepEqual(portraitPlan({ publisher: 'Marvel' }, 'organic'),
    { fields: ['portrait_url', 'image_url', 'image_md_url'], stylize: false });
});

test('portraitPlan: ad never references official art (only portrait_url or nothing)', () => {
  assert.deepEqual(portraitPlan({ publisher: 'Marvel' }, 'ad'), { fields: [], stylize: false }); // S: none
  assert.deepEqual(portraitPlan({ publisher: 'DC Comics' }, 'ad'), { fields: ['portrait_url'], stylize: true }); // A: stylized
  assert.deepEqual(portraitPlan({ publisher: 'Company-Licensed' }, 'ad'), { fields: ['portrait_url'], stylize: false }); // B: small-raw
  assert.deepEqual(portraitPlan({ publisher: 'In the Public Domain' }, 'ad'), { fields: ['portrait_url'], stylize: false }); // C: full
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/social/safety.test.mjs`
Expected: FAIL — `portraitPlan` not exported.

- [ ] **Step 3: Write the implementation**

Add `imgDataUri` to the existing `lib.mjs` import in `safety.mjs`:

```js
import { famousPool, imgDataUri } from './lib.mjs';
```

Append to `scripts/social/safety.mjs`:

```js
// Pure: which hero image fields may be used, and whether to stylize, per context.
// AD CONTEXT NEVER INCLUDES image_url/image_md_url — only the Mythique render.
export function portraitPlan(hero, context) {
  if (context === 'organic') {
    return { fields: ['portrait_url', 'image_url', 'image_md_url'], stylize: false };
  }
  switch (adImagery(hero)) {
    case 'stylized': return { fields: ['portrait_url'], stylize: true };
    case 'small-raw':
    case 'full': return { fields: ['portrait_url'], stylize: false };
    case 'none':
    default: return { fields: [], stylize: false };
  }
}

// I/O: resolve the first available allowed field to a data-URI. null = show no face.
export async function safePortrait(hero, { context }) {
  const plan = portraitPlan(hero, context);
  for (const f of plan.fields) {
    if (hero[f]) {
      const uri = await imgDataUri(hero[f]);
      if (uri) return { uri, stylize: plan.stylize };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/social/safety.test.mjs`
Expected: PASS — new `portraitPlan` tests pass with all prior tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/safety.mjs scripts/social/safety.test.mjs
git commit -m "feat(social): safePortrait choke point (ad never uses official art)"
```

---

### Task 4: `ads/ad-brand.mjs` — catalogue-scale brand ad  ⟵ VISUAL CHECKPOINT

**Files:**
- Create: `scripts/social/ads/ad-brand.mjs`

**Interfaces:**
- Consumes: `loadEnv`, `makeSb`, `fonts`, `OUT_DIR`, `renderPng` from `../lib.mjs`; `adShell` from `./shell.mjs`.
- Produces: a CLI. `node scripts/social/ads/ad-brand.mjs --size 1x1` → `out/social/ad-brand/<size>.png` + `caption.txt`. No character imagery at all (pure brand + catalogue scale).

**Sizes:** `1x1`→1080×1080, `4x5`→1080×1350, `9x16`→1080×1920, `16x9`→1920×1080, `og`→1200×630. `--size all` renders every size.

- [ ] **Step 1: Write the script**

Create `scripts/social/ads/ad-brand.mjs`:

```js
#!/usr/bin/env node
// Catalogue-scale brand ad — zero character IP. The safest paid creative:
// leans entirely on Mythique's brand, design system, and catalogue scale.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng } from '../lib.mjs';
import { adShell } from './shell.mjs';

const SIZES = { '1x1': [1080, 1080], '4x5': [1080, 1350], '9x16': [1080, 1920], '16x9': [1920, 1080], og: [1200, 630] };

async function heroCount(sb) {
  // exact count via PostgREST count header; fall back to a rounded literal
  try {
    const r = await fetch(`${sb.url}/rest/v1/heroes?select=id&limit=1`, { headers: { ...sb.headers, Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range'); // e.g. "0-0/35557"
    const n = cr && parseInt(cr.split('/')[1], 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

function body(count, F, w, h) {
  const big = Math.round(h * 0.11);
  const n = count ? `${(Math.floor(count / 1000) * 1000).toLocaleString()}+` : '30,000+';
  return adShell(F, { w, h }, `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${Math.round(w * 0.08)}px">
    <div style="font-size:${Math.round(h * 0.03)}px;letter-spacing:8px;color:#e0a83e;margin-bottom:${Math.round(h * 0.03)}px">THE HERO & VILLAIN ENCYCLOPEDIA</div>
    <div class="pop" style="font-size:${big}px;line-height:1;color:#e0a83e">${n}</div>
    <div style="font-size:${Math.round(h * 0.05)}px;margin:${Math.round(h * 0.01)}px 0 ${Math.round(h * 0.04)}px">heroes & villains, ranked & rated</div>
    <div style="font-size:${Math.round(h * 0.032)}px;color:#9db4c4">powers · matchups · rankings · lore</div>
    <div style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px" class="g">mythique.app</div>
  </div>`);
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const want = get('--size', '1x1');
  const sizes = want === 'all' ? Object.keys(SIZES) : [want];
  if (sizes.some((s) => !SIZES[s])) { console.error('--size must be one of:', Object.keys(SIZES).join(', '), 'or all'); process.exit(1); }

  const sb = makeSb(loadEnv());
  const count = await heroCount(sb);
  const F = fonts();
  const dir = join(OUT_DIR, 'ad-brand');
  mkdirSync(dir, { recursive: true });
  for (const s of sizes) {
    const [w, h] = SIZES[s];
    await renderPng(body(count, F, w, h), join(dir, `${s}.png`), w, h);
    console.log(`  -> ${join(dir, `${s}.png`)}`);
  }
  writeFileSync(join(dir, 'caption.txt'), [
    `The whole comic-book multiverse, ranked. ⚡`, ``,
    `${count ? count.toLocaleString() : '30,000+'} heroes & villains — powers, matchups, rankings & lore.`, ``,
    `Explore free on mythique.app`, ``,
    `#superheroes #comics #anime #whowouldwin #mythique`,
  ].join('\n'));
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Note: `makeSb` exposes `url` and `headers` (used by `heroCount`). If they are not currently exposed, add them to the returned object in `lib.mjs` (`return { url, headers, rest, rpc, invoke }`).

- [ ] **Step 2: Verify `makeSb` exposes `url`/`headers`**

Read `scripts/social/lib.mjs` `makeSb`. If the returned object lacks `url`/`headers`, add them:

```js
return { url, headers, async rest(path) { /* … */ }, /* … */ };
```

- [ ] **Step 3: Render the sample (VISUAL CHECKPOINT)**

Run: `node scripts/social/ads/ad-brand.mjs --size 1x1`
Expected: writes `out/social/ad-brand/1x1.png`. **Open it and confirm the look** (brand, catalogue number, disclaimer footer legible) before proceeding to Tasks 5–7. Adjust `body()` styling as needed, re-render, and only commit once it reads well.

- [ ] **Step 4: Commit**

```bash
git add scripts/social/ads/ad-brand.mjs scripts/social/lib.mjs
git commit -m "feat(social/ads): catalogue-scale brand ad generator"
```

---

### Task 5: `ads/ad-matchup.mjs` — data-first "who would win"

**Files:**
- Create: `scripts/social/ads/ad-matchup.mjs`

**Interfaces:**
- Consumes: `loadEnv`, `makeSb`, `fonts`, `OUT_DIR`, `renderPng`, `STAT_KEYS`, `resolveManual`, `hydrate` from `../lib.mjs`; `safePool`, `safePortrait` from `../safety.mjs`; `adShell` from `./shell.mjs`; `styleAttr` from `./stylize.mjs`.
- Produces: CLI `node scripts/social/ads/ad-matchup.mjs --matchup "A,B" --size 1x1` → `out/social/ad-matchup-<slug>/<size>.png` + caption. Data-forward: name plates + community vote bar + 6-stat comparison + verdict. Faces only per `safePortrait(..., {context:'ad'})`; when it returns null, render name plates only.

- [ ] **Step 1: Write the script**

Create `scripts/social/ads/ad-matchup.mjs`. Selection: with `--matchup "A,B"` use `resolveManual`; otherwise pick a pair from `safePool(sb, { maxTier: 'C' })` (only safe-to-depict) or, when data dominates and faces are omitted, from the wider famous pool. Compose: `adShell` background; two columns each showing — if `safePortrait` returns `{uri,stylize}`, an `<img>` (wrapped with `styleAttr(style)` when `stylize`), else a large name plate; a centered community-vote percentage bar; a six-row stat comparison using `STAT_KEYS`; the verdict line from `hydrate`. Append disclaimer via the shell. Write caption with `#whowouldwin` tags.

```js
#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng, STAT_KEYS, resolveManual, hydrate, slugFor } from '../lib.mjs';
import { safePortrait } from '../safety.mjs';
import { adShell } from './shell.mjs';
import { styleAttr } from './stylize.mjs';

const SIZES = { '1x1': [1080, 1080], '4x5': [1080, 1350], '9x16': [1080, 1920] };

function faceOrPlate(p, name, side, box) {
  if (!p) return `<div style="width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center;border:3px solid rgba(224,168,62,.5);border-radius:24px"><span class="pop" style="font-size:${Math.round(box * 0.18)}px;color:#e0a83e;text-align:center">${name}</span></div>`;
  const st = p.stylize ? styleAttr('duotone') : '';
  return `<div class="styl" style="width:${box}px;height:${box}px;border-radius:24px;overflow:hidden;border:3px solid rgba(224,168,62,.5)"><img src="${p.uri}" style="${st}"></div>`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const size = get('--size', '1x1');
  if (!SIZES[size]) { console.error('--size:', Object.keys(SIZES).join(', ')); process.exit(1); }
  const spec = get('--matchup', null);
  if (!spec) { console.error('Provide --matchup "A,B" (auto-pick from safePool lands in a later iteration).'); process.exit(1); }

  const sb = makeSb(loadEnv());
  const sel = await resolveManual(sb, spec);
  const data = await hydrate(sb, sel); // verdict, vote %, portraits (organic); we re-fetch safe ones below
  const [pa, pb] = await Promise.all([
    safePortrait(sel.ka, { context: 'ad' }),
    safePortrait(sel.kb, { context: 'ad' }),
  ]);

  const [w, h] = SIZES[size];
  const box = Math.round(w * 0.34);
  const statRows = STAT_KEYS.map((k) => {
    const a = sel.ka[k] ?? 0, b = sel.kb[k] ?? 0; const t = a + b || 1;
    return `<div style="display:flex;align-items:center;gap:14px;margin:6px 0">
      <span class="pop" style="width:70px;text-align:right;font-size:${Math.round(h * 0.028)}px">${a}</span>
      <div style="flex:1;height:14px;background:rgba(255,255,255,.08);border-radius:8px;overflow:hidden;display:flex">
        <div style="width:${(a / t) * 100}%;background:#e8823a"></div><div style="width:${(b / t) * 100}%;background:#37a3c4"></div></div>
      <span class="pop" style="width:70px;font-size:${Math.round(h * 0.028)}px">${b}</span></div>`;
  }).join('');

  const inner = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:${Math.round(h * 0.06)}px ${Math.round(w * 0.06)}px 0">
    <div style="font-size:${Math.round(h * 0.05)}px;letter-spacing:4px;color:#e0a83e;margin-bottom:${Math.round(h * 0.02)}px">WHO WOULD WIN?</div>
    <div style="display:flex;gap:${Math.round(w * 0.05)}px;align-items:center">
      ${faceOrPlate(pa, sel.ka.name, 'a', box)}
      <span class="pop" style="font-size:${Math.round(h * 0.06)}px;color:#e0a83e">VS</span>
      ${faceOrPlate(pb, sel.kb.name, 'b', box)}</div>
    <div style="display:flex;justify-content:space-between;width:100%;margin-top:14px;font-family:'S';font-size:${Math.round(h * 0.026)}px">
      <span>${sel.ka.name}</span><span>${sel.kb.name}</span></div>
    <div style="width:100%;height:${Math.round(h * 0.045)}px;border-radius:12px;overflow:hidden;display:flex;margin:${Math.round(h * 0.02)}px 0">
      <div style="width:${data.voteA}%;background:#e8823a;display:flex;align-items:center;padding-left:16px" class="pop">${data.voteA}%</div>
      <div style="width:${data.voteB}%;background:#37a3c4;display:flex;align-items:center;justify-content:flex-end;padding-right:16px" class="pop">${data.voteB}%</div></div>
    <div style="font-size:${Math.round(h * 0.02)}px;color:#9db4c4;margin-bottom:${Math.round(h * 0.02)}px">the community vote</div>
    <div style="width:100%">${statRows}</div>
  </div>`;

  const slug = slugFor(sel);
  const dir = join(OUT_DIR, `ad-matchup-${slug}`);
  mkdirSync(dir, { recursive: true });
  await renderPng(adShell(fonts(), { w, h }, inner), join(dir, `${size}.png`), w, h);
  writeFileSync(join(dir, 'caption.txt'), [
    `${sel.ka.name} vs ${sel.kb.name} — who wins? ⚔️`, ``,
    `The community says ${sel.ka.name} ${data.voteA}% / ${sel.kb.name} ${data.voteB}%. Cast your vote on mythique.app`, ``,
    `#whowouldwin #${sel.ka.name.replace(/[^a-z0-9]/gi, '')} #${sel.kb.name.replace(/[^a-z0-9]/gi, '')} #mythique`,
  ].join('\n'));
  console.log(`  -> ${dir}/${size}.png`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Render a sample and eyeball**

Run: `node scripts/social/ads/ad-matchup.mjs --matchup "Goku,Superman" --size 1x1`
Expected: `out/social/ad-matchup-goku-vs-superman/1x1.png`. Both are Tier S, so `safePortrait` returns null → **name plates, no faces** (correct). Confirm the data (vote bar, stats) reads well.

- [ ] **Step 3: Render a Tier-C/A sample to exercise faces/stylization**

Run: `node scripts/social/ads/ad-matchup.mjs --matchup "Dracula,Frankenstein's monster" --size 1x1` (public-domain → full faces) — adjust names to two that exist in your catalogue with `portrait_url`.
Expected: portraits render (Tier C full; a Tier-A name would render duotone). Confirm.

- [ ] **Step 4: Commit**

```bash
git add scripts/social/ads/ad-matchup.mjs
git commit -m "feat(social/ads): data-first matchup ad generator"
```

---

### Task 6: `ads/ad-ranking.mjs` — data-first leaderboard

**Files:**
- Create: `scripts/social/ads/ad-ranking.mjs`

**Interfaces:**
- Consumes: `loadEnv`, `makeSb`, `fonts`, `OUT_DIR`, `renderPng` from `../lib.mjs`; `tierOf`, `adImagery`, `safePortrait` from `../safety.mjs`; `adShell` from `./shell.mjs`; `styleAttr` from `./stylize.mjs`.
- Produces: CLI `node scripts/social/ads/ad-ranking.mjs --by fame --size 1x1` → `out/social/ad-ranking-<slug>/<size>.png` + caption. A Top-N leaderboard leaning on the proprietary `fame_score` (or a stat). Each row: rank, metric bar, name; a thumbnail only when `safePortrait` returns non-null (Tier C full; Tier A/B stylized); Tier-S rows show a name row with no face.

- [ ] **Step 1: Write the script**

Create `scripts/social/ads/ad-ranking.mjs` — fetch top-N ordered by `fame_score` (or `--by <stat>`) via `sb.rest('heroes?select=…&order=…&limit=N')`; for each row call `safePortrait(row, { context:'ad' })`; render rows with `adShell`; title emphasizes the Mythique metric ("RANKED BY MYTHIQUE FAME SCORE"); write caption with `#ranking` tags. Mirror the row layout of the organic `generate-rankings.mjs` `rankRow`, but swap the portrait for the `safePortrait` result (stylize when flagged, omit when null).

- [ ] **Step 2: Render a sample and eyeball**

Run: `node scripts/social/ads/ad-ranking.mjs --by fame --size 1x1`
Expected: `out/social/ad-ranking-*/1x1.png` — a leaderboard where most famous rows (Tier S/A) show stylized or no thumbnail, all data legible. Confirm.

- [ ] **Step 3: Commit**

```bash
git add scripts/social/ads/ad-ranking.mjs
git commit -m "feat(social/ads): data-first ranking ad generator"
```

---

### Task 7: `ads/ad-web-hero.mjs` — landing + OG card

**Files:**
- Create: `scripts/social/ads/ad-web-hero.mjs`

**Interfaces:**
- Consumes: `loadEnv`, `makeSb`, `fonts`, `OUT_DIR`, `renderPng` from `../lib.mjs`; `adShell` from `./shell.mjs`.
- Produces: CLI `node scripts/social/ads/ad-web-hero.mjs` → `out/social/ad-web-hero/hero-16x9.png` and `og.png` (1200×630). Brand + catalogue-scale composition for the website hero and OG share card; no character imagery (or Tier-C only). Reuses the `ad-brand` `body()` approach at 16:9 and OG sizes.

- [ ] **Step 1: Write the script** (compose `adShell` at `[1920,1080]` and `[1200,630]` with a hero headline + catalogue scale + `mythique.app`).

- [ ] **Step 2: Render and eyeball**

Run: `node scripts/social/ads/ad-web-hero.mjs`
Expected: two PNGs in `out/social/ad-web-hero/`. Confirm the 16:9 hero and OG card read well.

- [ ] **Step 3: Commit**

```bash
git add scripts/social/ads/ad-web-hero.mjs
git commit -m "feat(social/ads): website hero + OG card generator"
```

---

### Task 8: README — "Advertising vs organic" section

**Files:**
- Modify: `scripts/social/README.md`

- [ ] **Step 1: Add a section** documenting: the organic/ad split; that ad generators live in `ads/` and route imagery through `safety.mjs` (ads never use official art; faces only per tier); how to run the audit (`node scripts/social/audit-safety.mjs`); the four ad scripts + their `--size` options; and that all ad creative carries the disclaimer. Note the reminder that paid ads with Tier-S faces are the line not to cross.

- [ ] **Step 2: Commit**

```bash
git add scripts/social/README.md
git commit -m "docs(social): document organic vs advertising pipelines"
```

---

## Self-Review

**Spec coverage:** §4 `safePortrait` → Task 3. §5 stylization (duotone/poster/halftone, zero-dep) → Task 1. §7 four ad scripts + `ads/shell.mjs` → Tasks 2, 4–7. §8 README → Task 8. Silhouette correctly deferred (Phase 3). ✓

**Placeholder scan:** Tasks 1–4 carry full code. Tasks 5–7 give complete interfaces + composition specs; Task 5 carries full code, Tasks 6–7 compose the same established primitives (`adShell`/`safePortrait`/`styleAttr`) — the visual checkpoint at Task 4 sets the pattern they follow. ✓

**Type consistency:** `adShell(F,{w,h},inner,extra)`, `safePortrait(hero,{context})→{uri,stylize}|null`, `styleAttr(style)`, `portraitPlan(hero,context)→{fields,stylize}` are consistent across definition (Tasks 1–3) and consumption (Tasks 4–7). ✓

**Visual checkpoint:** Task 4 renders the first ad and pauses for human approval before Tasks 5–7 — matches the "verify visuals via screenshots" workflow and avoids building four templates against an unapproved look.
