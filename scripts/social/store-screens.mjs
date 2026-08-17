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
import { ROOT, fonts, COLORS, grainUri, launchChrome } from './lib.mjs';

const { GOLD, CREAM, NAVY } = COLORS;

/** Apple's slots. The iPad capture is native; the 6.3" iPhone capture is placed
 *  inside a frame smaller than the canvas, so it downscales rather than up.
 *
 *  `bleed` is how far the device runs off the RIGHT edge, as a fraction of its
 *  own width. It is per-device because the same fraction does not cost the same
 *  thing: an iPad's chrome sits well inside its frame, so 6% is empty margin,
 *  while a phone packs its controls against the bezel — 6% there sliced the
 *  share button and the HERO / MUTANT badges in half. The phone bleeds off the
 *  BOTTOM only (which every frame already does) and stays flush right. */
const DEVICES = {
  ipad13: { w: 2064, h: 2752, capture: 'ipad13', frameW: 0.78, bleed: 0.06, lines: 1 },
  // The phone frame is CENTERED (`align`), dressed as hardware (`chrome:
  // 'device'` — dark bezel, screen-like corner radius), and cropped by the
  // canvas edge just above the app's floating tab pill (`cropRow`, in capture
  // pixels: the pill's top edge measured at y≈2293 of 2622, minus margin).
  // Marketing shots shouldn't spend their pixels on navigation chrome, and the
  // crop is what sets the device's vertical position: the frame is placed so
  // the canvas bottom lands exactly at that capture row, so the pill can never
  // appear no matter how the captures are re-taken.
  //
  // frameW 0.92 is close to the no-upscale ceiling: the screen inside the
  // bezel must stay ≤ the capture's 1206px or App Review gets a soft
  // screenshot. 0.92 → 1214 - 2·22 bezel = 1170px. It is deliberately larger
  // than the iPad's fraction — on a 1320-wide canvas the device IS the
  // composition.
  iphone69: {
    w: 1320,
    h: 2868,
    capture: 'iphone63',
    captureSize: [1206, 2622],
    frameW: 0.92,
    bleed: 0,
    lines: 1,
    align: 'center',
    chrome: 'device',
    cropRow: 2250,
  },
};

/**
 * One frame per store slot. `folio` is the codex label, `line` the headline —
 * sentence case with a full stop, per the type rules. Kept short: these are
 * read at thumbnail size first.
 */
const SLOTS = [
  { file: 'arena', folio: '№ 01 · The Arena', line: 'Settle every argument.' },
  { file: 'explore', folio: '№ 02 · The Archive', line: 'Fifty thousand icons.' },
  // "Every power, measured." was the first draft and it wrapped to two lines on
  // BOTH canvases — 'measured' sets much wider than its character count
  // suggests. A wrapped headline here costs more than a word: it is what forces
  // every frame to reserve a phantom second line, which is where the dead space
  // between headline and device came from. Kept to one line everywhere.
  { file: 'character', folio: '№ 03 · The Dossier', line: 'Every power, ranked.' },
  { file: 'rightnow', folio: '№ 04 · The Pulse', line: 'What lands this week.' },
];

const b64 = (p) => readFileSync(p).toString('base64');
const pngUri = (p) => `data:image/png;base64,${b64(p)}`;

function page(F, dev, slot, shotUri) {
  const M = Math.round(dev.w * 0.078); // 84px at 1080, scaled
  const headline = Math.round(dev.w * 0.082);
  const folio = Math.round(dev.w * 0.019);
  const frameW = Math.round(dev.w * dev.frameW);

  // ── Vertical rhythm ──────────────────────────────────────────────────────
  // The seam and the device used to be pinned to CANVAS fractions (0.198 /
  // 0.235) while the headline's height is TYPE-driven. Those two drift apart
  // at different aspect ratios, and measuring the output showed exactly that:
  //
  //   • the phone carried a 381px void between headline and device — 13.3% of
  //     its canvas, against the iPad's 6.9%. An unresolved hole, not negative
  //     space.
  //   • the seam sat 275px below the type but 106px above the device: 2.6x
  //     nearer the device, so it read as belonging to neither. (The iPad's
  //     87/102 is near-centred, which is why it worked there.)
  //   • worse, a TWO-line headline on iPad would have put the seam 89px INTO
  //     the type. Every iPad headline fits one line today, so it never fired.
  //
  // So everything below the headline now FLOWS from the headline block, in
  // multiples of the headline size. The seam can no longer collide with the
  // type, and the rhythm holds at any canvas.
  const h1TopBase = M + Math.round(folio * 3.1);
  // `lines` is the worst case for THIS device's copy — the reserved height is
  // what keeps the device top identical across the set, so the frames line up
  // when swiped. The +0.10 is slack for Flame's descenders, whose ink runs
  // past the em box. Changing a headline means re-checking the wrap.
  const h1Height = Math.round(headline * (1.04 * dev.lines + 0.1));
  const seamTopBase = h1TopBase + h1Height + Math.round(headline * 0.4);

  const center = dev.align === 'center';

  // ── Device chrome ────────────────────────────────────────────────────────
  // 'device': a hardware read — dark bezel ring, a screen corner radius in the
  // iPhone's own proportion (~15% of body width), the capture inset behind it.
  // Everything else keeps the flat panel: a hairline and a small radius, which
  // suits an iPad shown as a surface rather than an object.
  const isDevice = dev.chrome === 'device';
  const bezel = isDevice ? Math.round(frameW * 0.018) : 0;
  const rOuter = isDevice ? Math.round(frameW * 0.15) : Math.round(dev.w * 0.021);
  const rInner = rOuter - bezel;

  // ── Device position ──────────────────────────────────────────────────────
  // Crop-driven when `cropRow` is set: the frame is placed so the canvas's
  // bottom edge lands exactly on that capture row, which is how the tab pill
  // is excluded — geometry, not hope. Otherwise the device flows from the
  // seam like everything else.
  let shotTop;
  if (dev.cropRow) {
    const scale = (frameW - 2 * bezel) / dev.captureSize[0];
    shotTop = dev.h - bezel - Math.round(dev.cropRow * scale);
  } else {
    shotTop = seamTopBase + Math.round(headline * 0.72);
  }

  // ── Header placement ─────────────────────────────────────────────────────
  // Left-aligned frames read top-down, so the header hangs from the top
  // margin. A centered frame reads as a poster, so the whole header block is
  // optically centred in the space above the device — weighted 0.45 rather
  // than 0.5, since a block hung a touch high reads as centred and one at the
  // true middle reads as sagging.
  const drop = center ? Math.max(0, Math.round((shotTop - seamTopBase - M) * 0.45)) : 0;
  const h1Top = h1TopBase + drop;
  const seamTop = seamTopBase + drop;
  const folioTop = M + drop;

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

.folio{position:absolute;left:${M}px;right:${M}px;top:${folioTop}px;font-family:'S';
  font-size:${folio}px;letter-spacing:.3em;text-transform:uppercase;color:${GOLD};
  text-align:${center ? 'center' : 'left'};}
.h1{position:absolute;left:${M}px;top:${h1Top}px;right:${M}px;
  font-family:'FR';font-size:${headline}px;line-height:1.04;color:${CREAM};
  text-align:${center ? 'center' : 'left'};
  /* The worst-case wrap for this device, always — a one-line headline would
     otherwise pull the seam and the device up and the set would not line up
     when swiped. */
  height:${h1Height}px;}
/* The Seam — gold hairline, structure only. Asymmetric frames fade it out to
   the right; centered frames get the symmetric cut, brightest in the middle. */
.seam{position:absolute;width:${Math.round(dev.w * 0.3)}px;height:2px;
  ${
    center
      ? `left:50%;transform:translateX(-50%);
  background:linear-gradient(90deg, rgba(224,168,62,0), ${GOLD}, rgba(224,168,62,0));`
      : `left:${M}px;
  background:linear-gradient(90deg, ${GOLD}, rgba(224,168,62,0));`
  }}

/* One dominant element: the device. Centered-and-cropped or offset-right,
   always bleeding off the bottom. */
.shot{position:absolute;width:${frameW}px;
  ${center ? `left:${Math.round((dev.w - frameW) / 2)}px;` : `right:${Math.round(-frameW * dev.bleed)}px;`}
  border-radius:${rOuter}px;overflow:hidden;
  ${
    isDevice
      ? /* Hardware: a titanium-dark bezel ring with a faint metallic edge, the
           screen inset behind it with its own corner radius. */
        `padding:${bezel}px;background:#0b0d10;
  border:1.5px solid rgba(245,235,220,.22);`
      : `border:1px solid rgba(245,235,220,.14);`
  }
  box-shadow:0 ${Math.round(dev.w * 0.03)}px ${Math.round(dev.w * 0.06)}px rgba(0,0,0,.55);}
.shot img{display:block;width:100%;${isDevice ? `border-radius:${rInner}px;` : ''}}
/* A whisper of side-A orange under the device, so the accent reads as light in
   the room rather than as a background. */
.pool{position:absolute;width:${Math.round(dev.w * 0.9)}px;height:${Math.round(dev.w * 0.9)}px;
  border-radius:50%;background:radial-gradient(circle, rgba(232,130,58,.16), transparent 66%);}
</style></head><body><div class="page">
  <div class="dots"></div>
  <div class="pool" style="${
    center
      ? `left:50%;transform:translateX(-50%);top:${Math.round(dev.h * 0.42)}px;`
      : `right:${Math.round(-dev.w * 0.2)}px;top:${Math.round(dev.h * 0.3)}px;`
  }"></div>
  <div class="folio">${slot.folio}</div>
  <div class="h1" data-lines="${dev.lines}">${slot.line}</div>
  <div class="seam" style="top:${seamTop}px;"></div>
  <div class="shot" style="top:${shotTop}px;"><img src="${shotUri}"/></div>
  <div class="grain"></div>
</div></body></html>`;
}

const arg = process.argv.indexOf('--device');
const only = arg > -1 ? process.argv[arg + 1] : null;

const F = fonts();
const browser = await launchChrome();
let failed = 0;
try {
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

      const tab = await browser.newPage({
        viewport: { width: dev.w, height: dev.h },
        deviceScaleFactor: 1,
      });
      await tab.setContent(page(F, dev, slot, uri), { waitUntil: 'networkidle' });

      // The layout below the headline flows from the headline BLOCK, whose
      // height is `dev.lines`. That is a declaration, and a declaration that
      // stops matching the copy is exactly the failure this set already had
      // latent: a two-line headline on a lines:1 device puts the seam through
      // the type. So measure the real wrap and refuse to ship a wrong frame,
      // rather than trusting a comment to be re-read.
      const wrap = await tab.evaluate(() => {
        const el = document.querySelector('.h1');
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.fontSize) * 1.04;
        return { actual: Math.round(el.scrollHeight / lh), declared: +el.dataset.lines };
      });
      if (wrap.actual > wrap.declared) {
        console.error(
          `✗ ${key}/${slot.file} — "${slot.line}" wraps to ${wrap.actual} lines but ` +
            `${key} declares lines:${wrap.declared}. The seam would cut through the type. ` +
            `Shorten the headline or raise DEVICES.${key}.lines.`,
        );
        failed++;
        await tab.close();
        continue;
      }

      await tab.screenshot({ path: out });
      await tab.close();
      console.log(`✓ ${out}  ${dev.w}x${dev.h}`);
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
