// Generate the social-content vector asset kit with Gemini image gen, then
// vectorize with potrace into tintable single-color SVGs. 100% our IP — no
// franchise tracing, generic archetypes only, so everything is safe in ads.
//
//   yarn node scripts/social/ads/gen-silhouettes.mjs [--only key1,key2] [--force]
//
// Output: assets/silhouettes/raw/<key>.png (generated bitmaps, gitignored ok)
//         assets/silhouettes/<key>.svg     (traced, checked in, used by renderers)
//
// Model: gemini-2.5-flash-image (~$0.04/image — the frugal tier; full kit < $1).
// Every asset is FLAT SOLID BLACK on PURE WHITE so potrace gets a clean
// bilevel trace and the renderers re-tint via fill/stroke.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_ = path.resolve(import.meta.dirname, '../../..');
const envText = fs.readFileSync(path.join(ROOT_, '.env.local'), 'utf8');
const KEY = process.env.GOOGLE_AI_STUDIO_API_KEY
  ?? /^\s*GOOGLE_AI_STUDIO_API_KEY\s*=\s*(.*)\s*$/m.exec(envText)?.[1]?.replace(/^["']|["']$/g, '');
if (!KEY) throw new Error('GOOGLE_AI_STUDIO_API_KEY missing from .env.local');
const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${KEY}`;

const ROOT = path.resolve(import.meta.dirname, '../../..');
const RAW_DIR = path.join(ROOT, 'assets/silhouettes/raw');
const SVG_DIR = path.join(ROOT, 'assets/silhouettes');

// Shared style preamble — the consistency contract across the whole kit.
const STYLE =
  'Flat solid pure-black vector-style graphic on a pure white background. ' +
  'Minimal, iconic, clean smooth confident curves, bold silhouette shapes, no interior detail, ' +
  'no outlines, no gradients, no gray, no shading, no texture — one solid black shape. ' +
  'Centered composition with generous white margin on all sides. Original generic design, ' +
  'NOT any existing character or logo from comics, movies or games.';

// Bust contract prepended to every silhouette prompt (includes the STYLE
// preamble — without it the model paints dramatic posters on dark backgrounds,
// which threshold to a solid black rectangle and trace to nothing).
const BUST =
  `${STYLE} Head-and-shoulders bust silhouette of a single figure facing forward, cropped at the chest ` +
  'with a clean straight horizontal bottom edge. The figure fills ~70% of the frame height. ' +
  'The entire figure is one solid black shape with NO background art, NO glow, NO scenery.';

const ASSETS = {
  // ── Mystery-character busts (VS plates, guess reveals, lore slides) ─────────
  hero: { kind: 'bust', prompt: `${BUST} A classic square-jawed male superhero with short neat hair and a strong heroic profile, broad shoulders.` },
  helm: { kind: 'bust', prompt: `${BUST} A warrior wearing a smooth full-face rounded combat helmet with a subtle crest ridge on top, armored broad shoulders.` },
  brute: { kind: 'bust', prompt: `${BUST} A hulking muscular brute: a small head sunk low between enormous mountainous trapezius muscles and massive shoulders.` },
  spikes: { kind: 'bust', prompt: `${BUST} A young fighter with short spiky hair: five or six thick angular spikes swept asymmetrically to one side, an original design.` },
  cowl: { kind: 'bust', prompt: `${BUST} A masked vigilante wearing a smooth rounded cowl with two short sharp cat-like ear points, high armored collar — an original design distinct from any famous bat-themed character.` },
  hood: { kind: 'bust', prompt: `${BUST} A mysterious figure in a deep hooded cloak, the hood forming a smooth pointed arch, face hidden in darkness (solid black).` },
  slick: { kind: 'bust', prompt: `${BUST} An elegant sinister villain with slicked-back hair forming a sharp widow's peak and a tall dramatic high collar rising beside the neck. The head is one solid black shape with absolutely NO facial features — no eyes, no nose, no mouth.` },
  femlong: { kind: 'bust', prompt: `${BUST} A heroic woman with long flowing wavy hair cascading past her shoulders, elegant neckline, slim shoulders.` },
  femcrop: { kind: 'bust', prompt: `${BUST} A confident woman with a sharp chin-length bob haircut, slim shoulders.` },
  caped: { kind: 'bust', prompt: `${BUST} A commanding figure wrapped in a full-length cape: the cape covers the shoulders completely and falls around the body like a wide bell, high cape collar framing the bare head. Tall vertical composition, clearly cloth, NOT wings.` },
  // ── Support kit (scene FX, emblems, backdrops — tinted gold/navy in code) ───
  burst: { kind: 'fx', prompt: `${STYLE} A comic-book impact burst / explosion starburst shape with irregular sharp radiating points, like a classic "POW" backdrop shape without any text.` },
  bolt: { kind: 'fx', prompt: `${STYLE} A single bold stylized lightning bolt with sharp angular segments, slightly dynamic diagonal composition.` },
  clash: { kind: 'fx', prompt: `${STYLE} A symmetrical "versus clash" emblem: two mirrored angular energy shards colliding at the center with a small burst at the impact point.` },
  laurel: { kind: 'fx', prompt: `${STYLE} A classic victory laurel wreath of two curved branches with clean leaf shapes, open at the top, symmetrical.` },
  crownmark: { kind: 'fx', prompt: `${STYLE} A minimal five-point crown emblem with a clean straight base, geometric and regal.` },
  linkmark: { kind: 'fx', prompt: `${STYLE} A minimal emblem of two interlocking chain links forming a subtle heart-like overlap at the center — a symbol of connection and family bonds.` },
  skyline: { kind: 'wide', prompt: `${STYLE} A wide panoramic city skyline silhouette strip along the bottom of the frame: varied rooftops, water towers, antennas, one tall art-deco tower. Wide landscape composition, skyline occupying the bottom third.` },
  herolanding: { kind: 'fx', prompt: `${STYLE} A full-body silhouette of a caped superhero in a dramatic three-point landing pose (one knee and one fist to the ground), cape flowing upward.` },
  flyby: { kind: 'wide', prompt: `${STYLE} A full-body silhouette of an original superhero flying horizontally with BOTH arms swept back along the body like a rocket, short cape trailing, a few clean horizontal speed-line streaks behind. Wide landscape composition.` },
};

const ASPECT = { bust: '1:1', fx: '1:1', wide: '16:9' };

async function generate(key, { prompt, kind }) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: ASPECT[kind] } },
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)));
    const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429 || res.status >= 500) continue;
    if (!res.ok) throw new Error(`${key}: Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) throw new Error(`${key}: no image in response (${json.candidates?.[0]?.finishReason ?? 'unknown'})`);
    return Buffer.from(part.inlineData.data, 'base64');
  }
  throw new Error(`${key}: rate-limited after retries`);
}

/** PNG → thresholded + content-cropped BMP (via Python PIL) → potrace SVG.
 *  Busts crop flush at the content's bottom edge so the renderers' flex-end
 *  plates seat them on the plate rim; everything else gets a uniform pad. */
function vectorize(key, kind) {
  const png = path.join(RAW_DIR, `${key}.png`);
  const bmp = path.join(RAW_DIR, `${key}.bmp`);
  const svg = path.join(SVG_DIR, `${key}.svg`);
  execFileSync('python3', ['-c', `
from PIL import Image, ImageOps
im = Image.open(${JSON.stringify(png)}).convert('L')
im = im.point(lambda p: 0 if p < 140 else 255, mode='1')
bbox = ImageOps.invert(im.convert('L')).getbbox()
if bbox:
    pad = max(im.size) // 40
    l, t, r, b = bbox
    bottom = min(im.size[1], b + (0 if ${JSON.stringify(kind)} == 'bust' else pad))
    im = im.crop((max(0, l - pad), max(0, t - pad), min(im.size[0], r + pad), bottom))
im.save(${JSON.stringify(bmp)})
`]);
  // alphamax 1.1 smooths corners into confident curves; opttolerance tightens size.
  execFileSync('potrace', [bmp, '--svg', '--alphamax', '1.1', '--opttolerance', '0.4', '--turdsize', '60', '-o', svg]);
  fs.rmSync(bmp);
  return svg;
}

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : Object.keys(ASSETS);
const force = process.argv.includes('--force');

fs.mkdirSync(RAW_DIR, { recursive: true });
for (const key of only) {
  const spec = ASSETS[key];
  if (!spec) { console.warn(`skip unknown key: ${key}`); continue; }
  const png = path.join(RAW_DIR, `${key}.png`);
  if (!force && fs.existsSync(png)) { console.log(`• ${key} (cached)`); }
  else {
    process.stdout.write(`⟳ ${key} …`);
    fs.writeFileSync(png, await generate(key, spec));
    console.log(' generated');
  }
  const svg = vectorize(key, spec.kind);
  console.log(`  ✓ ${path.relative(ROOT, svg)}`);
}
console.log('done');
