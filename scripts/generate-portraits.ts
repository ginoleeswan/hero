#!/usr/bin/env bun
/**
 * Hero portrait generation script.
 *
 * For each hero with portrait_url IS NULL, fetch their source image, send it +
 * wolverine/deadpool/thor refs to Gemini 3.1 Flash Image for style transfer,
 * upload the result straight to Cloudinary (public_id `hero-portraits/{id}`,
 * overwrite:true — same scheme the app reads), and write the Cloudinary
 * secure_url back to heroes.portrait_url.
 *
 * Portraits go directly to Cloudinary — no Supabase Storage hop, so no
 * migrate-portraits-to-cloudinary pass is ever needed. Supabase is used only to
 * read the working set and write portrait_url back.
 *
 * Usage:
 *   bun scripts/generate-portraits.ts               # full batch
 *   bun scripts/generate-portraits.ts --hero-id 69  # single hero (test)
 *   bun scripts/generate-portraits.ts --dry-run     # log without API calls
 *   bun scripts/generate-portraits.ts --concurrency 5
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY!;

// Cloudinary (portrait host). Signed uploads — same target as the app's URLs.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET!;

const GEMINI_MODEL = 'gemini-3.1-flash-image';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;
const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Style references — Wolverine, Deadpool, Thor: best painterly texture examples (v4 proven)
const ASSETS_DIR = join((import.meta as unknown as { dir: string }).dir, '../assets/images');
const STYLE_REF_PATHS = [
  join(ASSETS_DIR, 'wolverine.jpg'),
  join(ASSETS_DIR, 'deadpool.jpg'),
  join(ASSETS_DIR, 'thor.jpg'),
];

function buildPrompt(): string {
  return `The first image is the character to redraw. Images 2, 3, and 4 are style reference illustrations — study every detail and match the style exactly.

Redraw the character from image 1 as a strict pure side-profile portrait facing RIGHT (nose pointing right, pure 90-degree side view, exactly as in the references).

RENDERING: Painterly digital illustration — rich dimensional depth, visible surface quality. Skin has warm highlights, cool shadows, subtle colour variation. Costume materials feel real: fabric has texture, metal has sheen, leather has gloss. Exactly like the references — NOT flat vector, NOT plain cartoon.

BACKGROUND: Design a background that reflects this character's iconic visual identity. Choose BOTH a colour and a style:

COLOUR — Pick the single most iconic, vivid, saturated colour associated with this character's brand and aesthetic. It MUST strongly contrast with the character's costume and skin — never blend into them. Avoid near-black even for dark characters; instead use a vivid deep colour (e.g. electric blue, deep crimson, rich purple). Examples: Spider-Man → deep red, Superman → cobalt blue, Hulk → vivid green, Joker → royal purple, Thor → stormy blue-gold, Iron Man → vivid gold.

STYLE — Choose whichever of these best fits the character's visual identity:
• Flat bold colour with slight painterly/brushed canvas texture — versatile default for most characters
• Concentric circles / target rings — for characters with circular iconography (Captain America's shield, Magneto's magnetic fields, Hawkeye's target, etc.)
• Radiating sunburst / diverging lines — for powerful, radiant, or cosmic characters (Thor, Superman, Doctor Strange, Silver Surfer)
• Geometric pattern referencing their visual motif — web grid for Spider-Man, lightning for Flash, etc.

The background must have a strong, clean outline separating it from the character's silhouette. Slight painterly texture throughout, matching the reference style.

FRAMING: This is a HEADSHOT — the face and head fill the entire canvas. Think of a passport photo or a coin portrait — nothing but the face, with the very tops of the shoulders just barely visible at the bottom edge. The chin should be roughly 15% from the bottom of the image, the top of the head 10% from the top. Zero chest, zero torso. Portrait orientation (taller than wide).

The character MUST face RIGHT. Preserve costume colours and identity exactly. No text, no logos.`;
}

// The 34 heroes that already have curated local images (id → local file path)
const LOCAL_PORTRAITS: Record<string, string> = {
  '620': 'assets/images/spiderman.jpg',
  '346': 'assets/images/ironman.jpg',
  '70': 'assets/images/batman.jpg',
  '644': 'assets/images/superman.jpg',
  '370': 'assets/images/joker.jpg',
  '149': 'assets/images/captain-america.jpg',
  '226': 'assets/images/doctor-strange.jpg',
  '720': 'assets/images/wonder-woman.jpg',
  '717': 'assets/images/wolverine.jpg',
  '659': 'assets/images/thor.jpg',
  '332': 'assets/images/hulk.jpg',
  '213': 'assets/images/deadpool.jpg',
  '313': 'assets/images/hawkeye.jpg',
  '414': 'assets/images/loki.jpg',
  '687': 'assets/images/venom.jpeg',
  '630': 'assets/images/star-lord.jpg',
  '106': 'assets/images/black-panther.jpg',
  '30': 'assets/images/ant-man.jpg',
  '222': 'assets/images/doctor-doom.jpg',
  '208': 'assets/images/darth-vader.jpg',
  '479': 'assets/images/mysterio.jpg',
  '650': 'assets/images/terminator.jpeg',
  '225': 'assets/images/doctor-octopus.jpg',
  '299': 'assets/images/green-goblin.jpg',
  '423': 'assets/images/magneto.jpg',
  '196': 'assets/images/cyclops.jpg',
  '480': 'assets/images/mystique.jpg',
  '638': 'assets/images/storm.jpg',
  '75': 'assets/images/beast.jpg',
  '567': 'assets/images/rogue.jpg',
  '185': 'assets/images/colossus.png',
  '490': 'assets/images/nightcrawler.jpg',
  '710': 'assets/images/weapon-x.jpg',
  '274': 'assets/images/gambit.jpg',
};

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const heroIdFlag = args.find((_, i) => args[i - 1] === '--hero-id') ?? null;
const heroIdsFlag = args.find((_, i) => args[i - 1] === '--hero-ids') ?? null;
const heroIdsSet = heroIdsFlag ? new Set(heroIdsFlag.split(',').map((s) => s.trim())) : null;
const dryRun = args.includes('--dry-run');
const concurrencyArg = args.find((_, i) => args[i - 1] === '--concurrency');
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg, 10) : 3;
const limitArg = args.find((_, i) => args[i - 1] === '--limit');
const LIMIT = limitArg ? parseInt(limitArg, 10) : null;

// ─── Costume hint overrides ───────────────────────────────────────────────────
// Used when the source image is misleading (e.g. Clark Kent instead of Superman)
// or when the character's iconic weapon keeps appearing despite framing rules.
const COSTUME_HINTS: Record<string, string> = {
  // Superman keeps generating as Clark Kent
  '644':
    'Superman in his classic red and blue superhero costume with yellow S-shield on chest and red cape — NOT Clark Kent, NOT civilian clothes, NO glasses',
  // Framing / too much body
  '659':
    'Thor wearing his classic silver winged helmet and red cape — face and head ONLY filling entire canvas, NO hammer, NO Mjolnir, NO body, nothing below the very top of the shoulders',
  '717':
    'Wolverine in his classic yellow and blue X-Men mask — extreme close-up headshot, face fills entire canvas, NO claws, NO body below chin, nothing in hands',
  '332':
    'Hulk — massive angry green face, huge jaw, fills the entire canvas in extreme close-up — NO shirt, NO body, NO torn clothing, face only from crown to chin',
  '213':
    'Deadpool wearing his red and black mask with white eye lenses — extreme close-up headshot, mask fills entire canvas, NO body, NO weapons, head only',
  '479':
    'Mysterio — the large chrome fishbowl helmet/globe head fills the entire canvas from top to bottom, green bodysuit collar just barely visible at bottom edge — NO body, NO weapons',
  '480':
    'Mystique — blue skin, red hair, yellow eyes — extreme close-up face fills entire canvas, NO body, NO gun, head and face only',
  '185':
    'Colossus — silver metallic organic steel face and head, flat chrome finish with visible facial features — extreme close-up, face fills entire canvas, NO body, NO shoulders',
  '490':
    'Nightcrawler — blue fuzzy skin, pointed ears, yellow eyes, dark hair, sinister grin — extreme close-up face fills entire canvas, NO body, NO tail, head and face only. Style: clean painterly illustration like a high-end comic cover, bold graphic shapes, smooth rendering',
  // Loki horns making head appear small — frame accommodates horns but face must be large
  '414':
    'Loki in his golden curved horned helmet, green and gold armour — the face must be large and prominent filling the lower 70% of the canvas, the two tall curved horns extend upward into the top of the frame, face is not small',
  // Facing direction
  '630':
    'Star-Lord wearing his red helmet with fin details and glowing red eye lenses — STRICT pure 90-degree side profile facing directly RIGHT, nose pointing exactly right, one eye lens visible, face fills canvas',
  // White border artifacts
  '30': 'Ant-Man wearing his red and silver helmet — face fills entire canvas edge to edge, absolutely NO white border, NO white outline, NO padding around the edges, background colour bleeds to every edge',
  // Art style needs more Mitchell
  '222':
    'Doctor Doom wearing his iconic iron mask and dark green hooded cloak, the metal mask has a stern expression — clean bold graphic illustration style like a Mondo poster print, strong flat colour shapes, bold graphic forms, face fills canvas',
  '299':
    'Green Goblin wearing his classic purple and green goblin helmet with pointed ears, orange skin, menacing sharp-toothed grin, glowing orange eyes — NOT a jester, NOT medieval, classic Marvel villain goblin look',
  '225':
    'Doctor Octopus — Otto Octavius, bald head, round amber goggles, dark coat — four large mechanical metal tentacles visible curling behind his head in background, face fills canvas in strict side profile',
  '567':
    'Rogue — brown hair with a dramatic white streak at the front, green and yellow X-Men costume collar — clean bold graphic illustration style like a Mondo poster print, strong flat colour shapes, graphic poster quality. Extreme close-up, face fills canvas',
  // Hawkeye white artifacts
  '313':
    'Hawkeye wearing his purple tactical mask with H logo — face fills entire canvas, NO white areas on sides, background colour fills edge to edge, NO bow, NO quiver',
};

// ─── Supabase client (service role — write access to Storage) ─────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signed Cloudinary upload of in-memory image bytes. Signs sha1 of the
 * alphabetically-sorted signable params + api_secret (Cloudinary's spec), then
 * POSTs ourselves — the SDK uploader is unreliable under Bun. public_id
 * `hero-portraits/{id}` + overwrite:true keeps re-runs idempotent and matches
 * the URLs the app already serves.
 */
async function uploadToCloudinary(heroId: string, imageBytes: Uint8Array): Promise<string> {
  const publicId = `hero-portraits/${heroId}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(toSign + CLOUD_SECRET).digest('hex');

  const form = new FormData();
  form.append('file', new Blob([Buffer.from(imageBytes)], { type: 'image/jpeg' }), `${heroId}.jpg`);
  form.append('api_key', CLOUD_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const body = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !body.secure_url) {
    throw new Error(`Cloudinary upload failed for ${heroId}: ${body.error?.message ?? res.status}`);
  }
  return body.secure_url;
}

async function setPortraitUrl(heroId: string, url: string): Promise<void> {
  const { error } = await supabase.from('heroes').update({ portrait_url: url }).eq('id', heroId);
  if (error) throw new Error(`DB update failed for ${heroId}: ${error.message}`);
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const rawMime = res.headers.get('content-type') ?? '';
  const mimeType = rawMime.startsWith('image/') ? rawMime : 'image/jpeg';
  return { base64, mimeType };
}

async function describeCharacterVisually(
  sourceBase64: string,
  sourceMime: string,
): Promise<string> {
  const res = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: 'Describe only the visual appearance of this character — costume colours, materials, distinctive physical features, and overall aesthetic. Be specific. Do not name the character. 2-3 sentences.',
            },
            { inline_data: { mime_type: sourceMime, data: sourceBase64 } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return '';
  const json = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? '';
}

async function generatePortraitImagen(
  heroName: string,
  sourceBase64: string,
  sourceMime: string,
  heroId?: string,
): Promise<Uint8Array> {
  const hint = heroId ? COSTUME_HINTS[heroId] : undefined;
  const description = hint ?? (await describeCharacterVisually(sourceBase64, sourceMime));
  const prompt = `Limited edition Mondo poster art. ${heroName}${description ? ` — ${description}` : ''}.

POSE — STRICT RULE: Pure 90-degree side profile facing RIGHT. Nose pointing directly right. One eye visible. Absolutely no 3/4 view, no frontal face, no action pose, no weapons being held or raised. The character is simply facing right, still, like a coin portrait or a mugshot in profile.

FRAMING — STRICT RULE: Extreme close-up headshot. The face and head fill the ENTIRE canvas from edge to edge. Crown of the head at the very top, chin near the bottom. Only the very top hint of shoulders visible — no chest, no torso, no arms, no hands, no weapons. Think passport photo cropping but as a side profile.

STYLE: Clean painterly digital illustration — dimensional but controlled. Skin has warm highlights and cool shadows with smooth transitions. Costume and head materials rendered with subtle shading and clean edges — graphic and poster-quality, not photorealistic.

BACKGROUND: Choose a single vivid bold colour that maximally contrasts this character's dominant costume/skin colour — if green use red or orange; if blue use orange or yellow; if red use deep blue; if dark/black use vivid red, orange or electric blue. Use concentric circles for characters with circular motifs (shields, magnetic fields), flat bold colour otherwise. Never use a colour similar to the character.

No hard white outline — clean natural painted edge. Portrait orientation, taller than wide. No text, no logos, no weapons in frame.`;

  const res = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '3:4' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Imagen API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string }>;
    error?: { message: string };
  };
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`No image from Imagen 4: ${json.error?.message ?? 'unknown'}`);
  return Buffer.from(b64, 'base64');
}

async function callImageModel(parts: object[]): Promise<Uint8Array | 'PROHIBITED'> {
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`  ↻ Retrying in ${delay}ms (attempt ${attempt + 1}/4)…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const errText = await res.text();
      lastError = new Error(`Rate limited: ${errText}`);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      candidates: Array<{
        finishReason?: string;
        content: {
          parts: Array<{ inlineData?: { data: string }; inline_data?: { data: string } }>;
        };
      }>;
    };

    if (json.candidates?.[0]?.finishReason === 'PROHIBITED_CONTENT') return 'PROHIBITED';

    const imagePart = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data ?? p.inline_data?.data,
    );
    const imageData = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
    if (!imageData) throw new Error('No image in Gemini response');
    return Buffer.from(imageData, 'base64');
  }
  throw lastError ?? new Error('Gemini request failed after retries');
}

async function generatePortrait(
  sourceBase64: string,
  sourceMime: string,
  heroName: string,
  heroId: string,
): Promise<Uint8Array> {
  const styleRefs = STYLE_REF_PATHS.map((p) => ({
    inline_data: { mime_type: 'image/jpeg', data: readFileSync(p).toString('base64') },
  }));

  // Attempt 1: name + source image + style refs
  const result1 = await callImageModel([
    { text: `Character name: ${heroName}. ${buildPrompt()}` },
    { inline_data: { mime_type: sourceMime, data: sourceBase64 } },
    ...styleRefs,
  ]);

  if (result1 !== 'PROHIBITED') return result1;

  // Fallback: Gemini blocked this character — use Imagen 4 with visual description
  console.log(`  ⚠ ${heroName} blocked by Gemini content filter — falling back to Imagen 4`);
  return generatePortraitImagen(heroName, sourceBase64, sourceMime, heroId);
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

// ─── Phase 2: Generate AI portraits for remaining heroes ──────────────────────

const MITCHELL_IDS = new Set(Object.keys(LOCAL_PORTRAITS));

function priorityOrder(id: string): number {
  if (MITCHELL_IDS.has(id)) return 0; // Mitchell heroes first
  if (!id.startsWith('cv-')) return 1; // SuperheroAPI numeric IDs second
  return 2; // ComicVine cv- IDs last
}

async function phase2(filterHeroId?: string): Promise<void> {
  console.log('\n═══ Phase 2: Generating AI portraits ═══\n');

  let query = supabase
    .from('heroes')
    .select('id, name, image_url')
    .is('portrait_url', null)
    .not('image_url', 'is', null)
    .order('issue_count', { ascending: false, nullsFirst: false });

  if (filterHeroId) {
    query = query.eq('id', filterHeroId) as typeof query;
  } else if (heroIdsSet) {
    query = query.in('id', [...heroIdsSet]) as typeof query;
  }
  if (LIMIT) {
    query = query.limit(LIMIT) as typeof query;
  }

  const { data: heroes, error } = await query;
  if (error) throw new Error(`Failed to fetch heroes: ${error.message}`);
  if (!heroes?.length) {
    console.log('No heroes to process.');
    return;
  }

  console.log(`Processing ${heroes.length} heroes with concurrency=${CONCURRENCY}\n`);

  await withConcurrency(heroes, CONCURRENCY, async (hero, idx) => {
    const label = `[${idx + 1}/${heroes.length}] ${hero.name} (${hero.id})`;

    if (dryRun) {
      console.log(`  [dry-run] ${label}`);
      return;
    }

    try {
      console.log(`  ⟳ ${label}`);
      const { base64, mimeType } = await fetchImageAsBase64(hero.image_url!);
      const imageBytes = await generatePortrait(base64, mimeType, hero.name, hero.id);
      const url = await uploadToCloudinary(hero.id, imageBytes);
      await setPortraitUrl(hero.id, url);
      console.log(`  ✓ ${label} → ${url}`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
      // Don't throw — continue with remaining heroes
    }
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local',
    );
  }
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY must be set in .env.local');
  }
  if (!CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) {
    throw new Error(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in .env.local',
    );
  }

  console.log(`Hero Portrait Generator`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (heroIdFlag) console.log(`Filter: hero ${heroIdFlag} only`);
  if (heroIdsFlag) console.log(`Filter: heroes ${heroIdsFlag}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} heroes`);

  await phase2(heroIdFlag ?? undefined);

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
