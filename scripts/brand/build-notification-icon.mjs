#!/usr/bin/env node
// scripts/brand/build-notification-icon.mjs — regenerates the Android
// notification status-bar icon.
//
//   assets/notification-icon.png  — what expo-notifications ships to Android
//
// Android MASKS this asset: it keeps the alpha channel and throws the colour
// away, painting the silhouette in the system's own tint (ours is set to the
// brand orange in app.config.ts). A full-colour logo therefore renders as a
// solid white blob — the single most common way a notification icon goes wrong.
//
// So the source is the mask mark drawn as flat white on transparent, from the
// same MARK_PATH the OG cards and the in-app wordmark use. One shape, one
// source of truth, generated rather than hand-exported so it cannot drift.
//
// Android wants 96x96 (xxxhdpi) with the glyph inset from the edges — the
// system adds no padding of its own, and a mark that touches the bounds looks
// cramped against the status-bar clock.
//
// Run: node scripts/brand/build-notification-icon.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const SIZE = 96;
/** Fraction of the canvas the mark spans. The rest is breathing room. */
const INSET = 0.78;

// Pull the path straight out of the TS constant rather than duplicating it.
const src = readFileSync(resolve(ROOT, 'src/constants/brandMark.ts'), 'utf8');
const pathMatch = src.match(/export const MARK_PATH =\s*\n?\s*'([^']+)'/);
const viewBoxMatch = src.match(/export const MARK_VIEWBOX = '([^']+)'/);
if (!pathMatch || !viewBoxMatch) {
  throw new Error('Could not read MARK_PATH / MARK_VIEWBOX from src/constants/brandMark.ts');
}
const [, markPath] = pathMatch;
const [, viewBox] = viewBoxMatch;
const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);

// Fit the mark's box inside the inset square, centred.
const scale = (SIZE * INSET) / Math.max(vbW, vbH);
const drawW = vbW * scale;
const drawH = vbH * scale;
const x = (SIZE - drawW) / 2;
const y = (SIZE - drawH) / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(6)})">
    <g transform="translate(${-vbW === 0 ? 0 : 0} 0)">
      <svg viewBox="${viewBox}" width="${vbW}" height="${vbH}" overflow="visible">
        <path d="${markPath}" fill="#ffffff"/>
      </svg>
    </g>
  </g>
</svg>`;

const out = resolve(ROOT, 'assets/notification-icon.png');
await sharp(Buffer.from(svg)).png().toFile(out);

const { width, height, channels } = await sharp(out).metadata();
if (width !== SIZE || height !== SIZE) throw new Error(`unexpected size ${width}x${height}`);
if (channels !== 4) throw new Error(`notification icon must keep its alpha channel (got ${channels})`);

// A silhouette that is entirely opaque is the blob failure — assert there is
// real transparency around the mark before calling this a success.
const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
let transparent = 0;
for (let i = 3; i < data.length; i += info.channels) if (data[i] === 0) transparent += 1;
const pct = Math.round((transparent / (info.width * info.height)) * 100);
if (pct < 20) throw new Error(`only ${pct}% transparent — Android would render this as a blob`);

console.log(`notification-icon.png  ${SIZE}x${SIZE}, ${pct}% transparent`);
