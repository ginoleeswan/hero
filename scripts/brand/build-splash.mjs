#!/usr/bin/env node
// scripts/brand/build-splash.mjs — regenerates the native splash lockup.
//
// The native splash and the JS boot stage must show THE SAME PICTURE, because
// the JS stage takes over mid-launch and any difference reads as a jump. The
// only way to guarantee that is to generate both from one source of truth:
//
//   • assets/splash.png            — what the OS shows (this script draws it)
//   • assets/mythique-wordmark.svg — the outlined wordmark, for design use
//   • src/constants/logo.ts        — WORDMARK_PATH, what the JS stage draws
//
// The wordmark is OUTLINED from Righteous rather than set as live text. Two
// reasons: the OS splash is a raster and could never match live type exactly,
// and drawing type on the very first frame means gating on font load. As paths
// there is nothing to load and nothing to diverge.
//
// Geometry is expressed in LOCKUP POINTS. app.config.ts renders splash.png at
// `imageWidth: LOCKUP_W` points, centred on screen with its aspect preserved,
// so BootStage can reconstruct the exact same box from the screen size alone
// (see SPLASH_LOCKUP in src/constants/logo.ts). Change a number here and the
// JS stage follows automatically — but re-run this script AND rebuild natively,
// because splash.png is baked into the binary and cannot ship over the air.
//
//   yarn build:splash
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const opentype = require('@shuding/opentype.js');
const sharp = require('sharp');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ── The lockup ──────────────────────────────────────────────────────────────
// A tall box, centred on screen by the OS. The mark rides the upper third, the
// wordmark anchors the lower fifth. The box is deliberately NOT full-bleed: a
// full-bleed splash would have to be cover-cropped to each device's aspect and
// the wordmark's distance from the bottom would swing wildly. A fixed-width
// centred box lands within a few points of the same composition on every phone.
const LOCKUP_W = 300;
const LOCKUP_H = 560;
const MARK_W = 160; // mark ink width
const MARK_CY = 163; // mark ink centre, from the box top
const WORD_W = 152; // wordmark ink width
const WORD_CY = 528; // wordmark ink centre, from the box top
const BEIGE = '#f5ebdc';
const SCALE = 3; // export at @3x

// True cubic-curve bounds of LOGO_MASK_PATH (not the control hull, which
// overstates the width by ~7%). Kept in step with LOGO_INK in logo.ts.
const LOGO_INK = { x: 100.74759, y: 359.60217, w: 822.60052, h: 307.71218 };

function logoPath() {
  const src = readFileSync(resolve(ROOT, 'src/constants/logo.ts'), 'utf8');
  const m = src.match(/LOGO_MASK_PATH =\s*'(M[^']+)'/);
  if (!m) throw new Error('LOGO_MASK_PATH not found in src/constants/logo.ts');
  return m[1];
}

/**
 * True bounds of an opentype command list. Curve extremes are solved from the
 * derivative rather than taken from the control points — a control hull can
 * overstate a glyph's ink box by several percent, and every position in the
 * lockup is measured from this box.
 */
function commandBounds(cmds) {
  let x = 0;
  let y = 0;
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  const hit = (px, py) => {
    if (px < box.x1) box.x1 = px;
    if (px > box.x2) box.x2 = px;
    if (py < box.y1) box.y1 = py;
    if (py > box.y2) box.y2 = py;
  };
  const extremes = (p0, p1, p2, p3) => {
    const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
    const b = 6 * (p0 - 2 * p1 + p2);
    const c = 3 * (p1 - p0);
    const ts = [];
    if (Math.abs(a) < 1e-9) {
      if (Math.abs(b) > 1e-9) ts.push(-c / b);
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        ts.push((-b + s) / (2 * a), (-b - s) / (2 * a));
      }
    }
    return ts
      .filter((t) => t > 0 && t < 1)
      .map((t) => {
        const u = 1 - t;
        return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
      });
  };
  for (const c of cmds) {
    if (c.type === 'M' || c.type === 'L') {
      hit(c.x, c.y);
      x = c.x;
      y = c.y;
    } else if (c.type === 'C') {
      hit(c.x, c.y);
      for (const v of extremes(x, c.x1, c.x2, c.x)) hit(v, y);
      for (const v of extremes(y, c.y1, c.y2, c.y)) hit(x, v);
      x = c.x;
      y = c.y;
    } else if (c.type === 'Q') {
      hit(c.x, c.y);
      for (const v of extremes(x, x + (2 / 3) * (c.x1 - x), c.x + (2 / 3) * (c.x1 - c.x), c.x))
        hit(v, y);
      for (const v of extremes(y, y + (2 / 3) * (c.y1 - y), c.y + (2 / 3) * (c.y1 - c.y), c.y))
        hit(x, v);
      x = c.x;
      y = c.y;
    }
  }
  return box;
}

/**
 * Outline `mythique` in Righteous and normalise it so its ink box is exactly
 * `0 0 1000 h`. Normalising here means every consumer can place it by ink box
 * with no metrics maths and no per-call bounds measurement.
 */
function wordmark() {
  const ttf = resolve(ROOT, 'node_modules/@expo-google-fonts/righteous/400Regular');
  const buf = readFileSync(resolve(ttf, 'Righteous_400Regular.ttf'));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const EM = 1000;
  // The landing page sets the wordmark at -0.023em; carry the same tracking so
  // the splash is the brand's treatment rather than a second interpretation.
  const TRACK = -0.023 * EM;
  const glyphs = font.stringToGlyphs('mythique');
  const path = new opentype.Path();
  let x = 0;
  for (const g of glyphs) {
    const gp = g.getPath(x, 0, EM);
    path.extend(gp);
    x += (g.advanceWidth / font.unitsPerEm) * EM + TRACK;
  }
  const b = commandBounds(path.commands);
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const k = 1000 / w;
  // getPath() already returns SVG-space coordinates (y down, baseline at the
  // given y), so this only shifts the ink box to the origin and scales it —
  // flipping y here would stand the wordmark on its head.
  const norm = new opentype.Path();
  norm.commands = path.commands.map((c) => {
    const out = { type: c.type };
    for (const [a, v] of Object.entries(c)) {
      if (a === 'type') continue;
      out[a] = a.startsWith('x') ? (v - b.x1) * k : (v - b.y1) * k;
    }
    return out;
  });
  return { d: norm.toPathData(3), aspect: w / h, height: +(h * k).toFixed(3) };
}

function lockupSvg(logoD, word) {
  // Mark: viewBox units → lockup points.
  const mk = MARK_W / LOGO_INK.w;
  const mx = LOCKUP_W / 2 - (LOGO_INK.x + LOGO_INK.w / 2) * mk;
  const my = MARK_CY - (LOGO_INK.y + LOGO_INK.h / 2) * mk;
  // Wordmark: normalised 1000-wide ink box → lockup points.
  const wk = WORD_W / 1000;
  const wx = LOCKUP_W / 2 - WORD_W / 2;
  const wy = WORD_CY - (word.height * wk) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LOCKUP_W * SCALE}" height="${
    LOCKUP_H * SCALE
  }" viewBox="0 0 ${LOCKUP_W} ${LOCKUP_H}">
  <g transform="translate(${mx.toFixed(4)} ${my.toFixed(4)}) scale(${mk.toFixed(6)})"><path d="${logoD}" fill="${BEIGE}"/></g>
  <g transform="translate(${wx.toFixed(4)} ${wy.toFixed(4)}) scale(${wk.toFixed(6)})"><path d="${word.d}" fill="${BEIGE}"/></g>
</svg>`;
}

const logoD = logoPath();
const word = wordmark();

writeFileSync(
  resolve(ROOT, 'assets/mythique-wordmark.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${word.height}"><path d="${word.d}" fill="${BEIGE}"/></svg>\n`,
);

const svg = lockupSvg(logoD, word);
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(ROOT, 'assets/splash.png'));

// Hand the JS side the numbers it needs to rebuild this box from a screen size.
const meta = {
  lockup: { w: LOCKUP_W, h: LOCKUP_H },
  mark: { w: MARK_W, cy: MARK_CY },
  wordmark: { w: WORD_W, cy: WORD_CY, aspect: +word.aspect.toFixed(6), viewH: word.height },
};
console.log(JSON.stringify(meta, null, 2));
console.log(
  `\nwrote assets/splash.png (${LOCKUP_W * SCALE}x${LOCKUP_H * SCALE}) + assets/mythique-wordmark.svg`,
);
console.log('Paste WORDMARK_PATH into src/constants/logo.ts if the outline changed:\n');
console.log(word.d.slice(0, 120) + '…');
