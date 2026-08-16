// scripts/social/store-screens.mjs — App Store screenshots, in the brand's own
// language rather than the App Store's.
//
// The first pass at these was a flat orange field with a centred SF Pro Black
// headline over a device mockup. That is the stock template every ASO tutorial
// ships, and `docs/brand/design-language.md` rules it out by name: "no centered
// icon-eyebrow-headline poster grammar". It also spent the brand's one loud
// colour as a GROUND, when orange here is a side-A accent.
//
// So this builds on the same toolkit the social pack uses — `lib.mjs`'s fonts,
// COLORS, grain and `renderPng` — and follows the design language:
//
//   ground     NAVY ink with the off-top radial lift, never pure black
//   folio      FlameSans, ALL CAPS, gold, wide tracking — the codex voice
//   headline   Flame-Regular ONLY, sentence case, ends with a period
//   seam       a gold hairline; structure is gold, body text never is
//   layout     asymmetric, one dominant element, 84px margins at 1080
//   grain      4-5%, overlay, on everything
//
// The device capture is a real simulator screenshot, scaled and never redrawn —
// App Review 2.3 requires screenshots to depict the actual app.
//
// Usage: node scripts/social/store-screens.mjs [--device ipad13|iphone69]
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fonts, COLORS, grainUri, renderPng } from './lib.mjs';

const { GOLD, CREAM, NAVY } = COLORS;

/** Apple's slots. The iPad capture is native; the 6.3" iPhone capture is placed
 *  inside a frame smaller than the canvas, so it downscales rather than up. */
const DEVICES = {
  ipad13: { w: 2064, h: 2752, capture: 'ipad13', frameW: 0.78 },
  iphone69: { w: 1320, h: 2868, capture: 'iphone63', frameW: 0.82 },
};

/**
 * One frame per store slot. `folio` is the codex label, `line` the headline —
 * sentence case with a full stop, per the type rules. Kept short: these are
 * read at thumbnail size first.
 */
const SLOTS = [
  { file: 'arena', folio: '№ 01 · The Arena', line: 'Settle every argument.' },
  { file: 'explore', folio: '№ 02 · The Archive', line: 'Fifty thousand icons.' },
  { file: 'character', folio: '№ 03 · The Dossier', line: 'Every power, measured.' },
  { file: 'rightnow', folio: '№ 04 · The Pulse', line: 'What lands this week.' },
];

const b64 = (p) => readFileSync(p).toString('base64');
const pngUri = (p) => `data:image/png;base64,${b64(p)}`;

function page(F, dev, slot, shotUri) {
  const M = Math.round(dev.w * 0.078); // 84px at 1080, scaled
  const headline = Math.round(dev.w * 0.082);
  const folio = Math.round(dev.w * 0.019);
  const frameW = Math.round(dev.w * dev.frameW);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'FR';src:url(data:font/ttf;base64,${F.FR});}
@font-face{font-family:'S';src:url(data:font/ttf;base64,${F.S});}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${dev.w}px;height:${dev.h}px;overflow:hidden;background:${NAVY};}
.page{position:relative;width:${dev.w}px;height:${dev.h}px;overflow:hidden;
  background:
    radial-gradient(58% 34% at 22% 12%, rgba(224,168,62,.13), transparent 64%),
    radial-gradient(120% 78% at 50% 4%, #12242f, ${NAVY} 70%);}
/* The dot grid the social slides carry, masked so it fades out of the corners. */
.dots{position:absolute;inset:0;background-image:radial-gradient(circle, rgba(224,168,62,.09) 1.4px, transparent 2px);
  background-size:${Math.round(dev.w / 34)}px;
  -webkit-mask-image:radial-gradient(120% 90% at 30% 18%, #000 10%, transparent 68%);opacity:.6;}
.grain{position:absolute;inset:0;background-image:url("${grainUri()}");background-size:340px;opacity:.05;mix-blend-mode:overlay;}

.folio{position:absolute;left:${M}px;top:${M}px;font-family:'S';
  font-size:${folio}px;letter-spacing:.3em;text-transform:uppercase;color:${GOLD};}
.h1{position:absolute;left:${M}px;top:${M + Math.round(folio * 3.1)}px;right:${M}px;
  font-family:'FR';font-size:${headline}px;line-height:1.04;color:${CREAM};
  /* Two lines' worth, always. One-line headlines would otherwise pull the seam
     and the device up and the set would not line up when swiped. */
  height:${Math.round(headline * 2.12)}px;}
/* The Seam — gold hairline, structure only. Stops short of the right margin so
   the frame stays asymmetric. */
.seam{position:absolute;left:${M}px;width:${Math.round(dev.w * 0.3)}px;height:2px;
  background:linear-gradient(90deg, ${GOLD}, rgba(224,168,62,0));}

/* One dominant element: the device, offset right and bleeding off the bottom. */
.shot{position:absolute;width:${frameW}px;right:${Math.round(-frameW * 0.06)}px;
  border-radius:${Math.round(dev.w * 0.021)}px;overflow:hidden;
  border:1px solid rgba(245,235,220,.14);
  box-shadow:0 ${Math.round(dev.w * 0.03)}px ${Math.round(dev.w * 0.06)}px rgba(0,0,0,.55);}
.shot img{display:block;width:100%;}
/* A whisper of side-A orange under the device, so the accent reads as light in
   the room rather than as a background. */
.pool{position:absolute;width:${Math.round(dev.w * 0.9)}px;height:${Math.round(dev.w * 0.9)}px;
  border-radius:50%;background:radial-gradient(circle, rgba(232,130,58,.16), transparent 66%);}
</style></head><body><div class="page">
  <div class="dots"></div>
  <div class="pool" style="right:${Math.round(-dev.w * 0.2)}px;top:${Math.round(dev.h * 0.3)}px;"></div>
  <div class="folio">${slot.folio}</div>
  <div class="h1">${slot.line}</div>
  <div class="seam" style="top:${Math.round(dev.h * 0.198)}px;"></div>
  <div class="shot" style="top:${Math.round(dev.h * 0.235)}px;"><img src="${shotUri}"/></div>
  <div class="grain"></div>
</div></body></html>`;
}

const arg = process.argv.indexOf('--device');
const only = arg > -1 ? process.argv[arg + 1] : null;

const F = fonts();
for (const [key, dev] of Object.entries(DEVICES)) {
  if (only && only !== key) continue;
  const outDir = join(ROOT, 'store', 'screenshots', key);
  mkdirSync(outDir, { recursive: true });
  for (const [i, slot] of SLOTS.entries()) {
    const shot = join(ROOT, 'store', 'captures', dev.capture, `${slot.file}.png`);
    let uri;
    try {
      uri = pngUri(shot);
    } catch {
      console.log(`skip ${key}/${slot.file} — no capture at ${shot}`);
      continue;
    }
    const out = join(outDir, `${String(i + 1).padStart(2, '0')}-${slot.file}.png`);
    await renderPng(page(F, dev, slot, uri), out, dev.w, dev.h);
    console.log(`✓ ${out}  ${dev.w}x${dev.h}`);
  }
}
