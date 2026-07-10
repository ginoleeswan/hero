// Brand plates library — painted ENVIRONMENTS (never faces, never text) in the
// app's house painterly style. Generated once with gemini-3.1-flash-image,
// curated by eye, then reused as the backdrop layer under carousels, the brand
// kit, ads, and reels (slow Ken Burns drift in CSS). The brand is the venue:
// these plates are the venue's rooms.
//
//   yarn node scripts/social/gen-plates.mjs [--only arena,sky] [--force]
//
// Output: scripts/social/plates/<key>.png  (9:16 masters — reels use them
// natively; square/landscape crops happen at compose time)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const envText = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const KEY = process.env.GOOGLE_AI_STUDIO_API_KEY
  ?? /^\s*GOOGLE_AI_STUDIO_API_KEY\s*=\s*(.*)\s*$/m.exec(envText)?.[1]?.replace(/^["']|["']$/g, '');
if (!KEY) throw new Error('GOOGLE_AI_STUDIO_API_KEY missing');
const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${KEY}`;
const OUT = path.join(ROOT, 'scripts/social/plates');

// House style contract — matches the app's portrait pipeline language, minus
// figures. Full-bleed is non-negotiable: any painted border/frame poisons the
// compositing layer.
const STYLE =
  'High-end hand-PAINTED 2D illustration — gouache and oil texture, visible brushwork, ' +
  'rich dimensional light, painterly canvas grain. NOT a 3D render, NOT CGI, NOT a photograph, NOT flat vector art. ' +
  'ABSOLUTELY NO people, NO figures, NO faces, NO creatures, NO text, NO logos, NO watermark. ' +
  'FULL-BLEED edge-to-edge painting: no border, no frame, no parchment edge, no vignette card — the paint reaches every pixel of the canvas. ' +
  'Palette anchored in deep navy ink (#0b1820), warm gold (#e0a83e), cream highlights, with restrained orange and teal accents. ' +
  'Dark, atmospheric, elegant — the background must stay quiet enough for cream display type to sit on top. Tall portrait orientation.';

const PLATES = {
  arena: `A vast dark colosseum arena at night seen from the fighter's floor: two great shafts of light crossing at center stage — warm orange from the left, cool teal from the right — meeting in a soft golden haze, tiered darkness rising all around, faint gold dust motes in the beams. Lower half of the canvas nearly black for legibility. ${STYLE}`,
  sky: `A deep midnight sky for a celestial atlas: sparse delicate gold stars, two or three faint constellation line-figures, wisps of dark teal and deep amber nebula, the darkness dominating ninety percent of the canvas. ${STYLE}`,
  vault: `The great hall of a mythic archive at night: towering dark shelves vanishing upward into shadow, thousands of faint gilded book spines catching a warm central glow, gold dust hanging in a single shaft of light, floor reflections. ${STYLE}`,
  dawn: `An open sky of painted dawn: towering warm gold and amber cloudbanks lit from below, rays breaking upward, the upper third deepening into dark navy so type can sit there. Hopeful, heroic, luminous. ${STYLE}`,
  dusk: `A brooding painted duskscape: deep teal storm clouds over a darkening horizon, cold blue-green light bleeding through the seams, the upper third deepening into near-black navy. Ominous, regal, villainous. ${STYLE}`,
  clash: `An abstract collision of two energies on deep navy: a warm orange wave breaking against a cold teal wave at the center, gold sparks scattering at the impact line, both fading into darkness at the edges. ${STYLE}`,
  throne: `An empty obsidian throne room at night: a distant dark throne on a raised dais backlit by a thin gold rim of light, polished black floor with faint reflections, everything else falling into deep navy shadow. ${STYLE}`,
  library_paper: `A warm cream parchment field seen flat-on, subtle painted paper fibre texture, faint gold marginalia flourishes and hairline rules in the corners only, the center calm and empty for type. Light, warm, scholarly — cream dominates. ${STYLE.replace('Dark, atmospheric, elegant', 'Light, warm, scholarly')}`,
};

async function gen(key, prompt) {
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '9:16' } } };
  for (let a = 0; a < 4; a++) {
    if (a > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (a - 1)));
    const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429 || res.status >= 500) continue;
    if (!res.ok) throw new Error(`${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) throw new Error(`${key}: no image (${json.candidates?.[0]?.finishReason})`);
    return Buffer.from(part.inlineData.data, 'base64');
  }
  throw new Error(`${key}: retries exhausted`);
}

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : Object.keys(PLATES);
const force = process.argv.includes('--force');
fs.mkdirSync(OUT, { recursive: true });
for (const key of only) {
  const prompt = PLATES[key];
  if (!prompt) { console.warn(`skip unknown: ${key}`); continue; }
  const file = path.join(OUT, `${key}.png`);
  if (!force && fs.existsSync(file)) { console.log(`• ${key} (cached)`); continue; }
  process.stdout.write(`⟳ ${key} …`);
  fs.writeFileSync(file, await gen(key, prompt));
  console.log(' ✓');
}
console.log(`done → ${path.relative(ROOT, OUT)}`);
