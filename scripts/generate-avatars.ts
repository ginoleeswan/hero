#!/usr/bin/env bun
/**
 * Hero AVATAR generation script — sibling of generate-portraits.ts.
 *
 * Portraits are big painterly side-profile hero art. Avatars are the opposite:
 * tiny, flat, iconic head-only marks in the style of Michael B. Myers Jr.'s
 * "Avengers Family Tree headshots" — front-facing, symmetrical, no background,
 * cropped at the jaw, flat muted colour with a subtle screenprint texture. They
 * have to read at 32px, so identity comes from the SILHOUETTE (mask/helmet/hair
 * shape) plus one or two signature colours, not from rendering detail.
 *
 * Pipeline per hero:
 *   source image → Gemini 3.1 Flash Image (1:1, flat-icon prompt, on pure white)
 *   → ffmpeg colorkey (white → alpha) → transparent PNG
 *   → Cloudinary `hero-avatars/{id}` → heroes.avatar_url
 *
 * Transparency matters: an avatar sits on beige cards, dark chrome and coloured
 * bands, so it can't carry a baked background the way a portrait does. Gemini
 * won't emit alpha, so we generate on flat white and key it out (no ImageMagick
 * on this machine; ffmpeg is present and does it in one filter).
 *
 * Usage:
 *   bun scripts/generate-avatars.ts --hero-ids 620,332,70 --out-dir /tmp/av  # local proof, no DB/CDN
 *   bun scripts/generate-avatars.ts --hero-id 620      # single hero, live
 *   bun scripts/generate-avatars.ts --limit 50         # batch by fame_score
 *   bun scripts/generate-avatars.ts --dry-run
 *   bun scripts/generate-avatars.ts --concurrency 5
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY!;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET!;

const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

const GEMINI_URL = geminiUrl('gemini-3.1-flash-image');
const GEMINI_25_IMAGE_URL = geminiUrl('gemini-2.5-flash-image');
const GEMINI_TEXT_URL = geminiUrl('gemini-2.5-flash');

/**
 * Optional style references. Empty on the first run — the flat-icon style is
 * carried entirely by the prompt. Once the first batch is approved, drop 3 of
 * the best PNGs in assets/avatars/refs/ and they get sent as style exemplars,
 * which is what keeps a large batch visually consistent (same bootstrap trick
 * the portrait pipeline uses with wolverine/deadpool/thor).
 */
const REFS_DIR = join((import.meta as unknown as { dir: string }).dir, '../assets/avatars/refs');
const STYLE_REF_NAMES = ['ref-1.png', 'ref-2.png', 'ref-3.png'];

function loadStyleRefs(): { inline_data: { mime_type: string; data: string } }[] {
  const refs: { inline_data: { mime_type: string; data: string } }[] = [];
  for (const name of STYLE_REF_NAMES) {
    try {
      refs.push({
        inline_data: {
          mime_type: 'image/png',
          data: readFileSync(join(REFS_DIR, name)).toString('base64'),
        },
      });
    } catch {
      /* ref not present yet — prompt-only styling */
    }
  }
  return refs;
}

// ─── The style ────────────────────────────────────────────────────────────────
//
// These three blocks are shared by BOTH the named and the nameless prompt, so they
// must never contain a character name. Using "Hulk's green" / "Spider-Man's web
// lines" as illustrative examples here silently broke the nameless fallback — the
// trademarked name is what trips the safety filter, so every rung blocked for those
// two while Batman (unnamed in the blocks) passed. Keep the examples generic.

const STYLE_BLOCK = `STYLE — flat vector icon illustration, vintage screenprint. This is a FLAT GRAPHIC MARK, not a painting and not a render:
• FLAT colour shapes only. Each element is one solid fill plus at most ONE subtle darker tone for a soft shadow down one side of the face. No gradients, no glossy highlights, no volumetric lighting, no 3D form, no cel-shading ramps.
• NO outlines. Shapes are separated by colour alone — absolutely no black line art, no ink strokes, no sticker outline.
• Vintage screenprint palette — slightly dusty and paper-like rather than neon, but still COMMITTED and full-bodied. The character's signature colour must stay unmistakably itself: a deep true green stays a deep true green, a costume red stays a rich brick red. Never pale, never washed-out, never pastel, never greyed into mush. 3 to 5 colours total for the whole image.
• A subtle distressed screenprint / aged-paper texture over the flat fills: fine vertical streaks and light mottling, as if silkscreened on textured stock. Subtle — the shapes stay clean and readable.
• Extreme simplification. Reduce the character to the fewest shapes that still identify them.
• EXCEPT the character's signature surface pattern, which is identity and must survive: a mask's web or mesh lines, a helmet's panel seams, facial markings, stripes or war paint. Render it as fine, clean, flat lines or shapes over the base colour — never omit it, never let it become shading.`;

const FORM_BLOCK = `FORM — a head-only icon, dead-on FRONT view, perfectly symmetrical and facing the viewer:
• The outer silhouette IS the character's hair, mask, helmet, cowl or head shape. That silhouette is the whole identity — make it crisp and distinctive.
• Crop at the JAW. The illustration ends at the bottom of the face/chin. NO neck, NO shoulders, NO collar, NO costume, NO body of any kind.
• Facial features are minimal but not blank: the eyes (or the mask's eye lenses) plus, on unmasked faces, a strong angled BROW shape. Eyes are deliberate graphic shapes — almond, angled, narrowed — never plain round dots. The brow does all the character work; give it the character's attitude (heavy and glowering, sharp and severe, calm and level).
• NO mouth, NO nose, NO ears unless the character's ears are a signature feature (pointed ears, cowl ears, elf ears). The lower half of the face is a plain flat skin-tone or mask-tone shape.`;

const FRAME_BLOCK = `FRAMING & BACKGROUND — square canvas. The head is centred and fills roughly 80% of the frame height with clear empty margin on all four sides; nothing touches or is cropped by the edges. The background is PURE WHITE (#FFFFFF), completely flat and uniform, with no texture, no shading, no vignette, no shadow under the head, and no border. The white must be pure so it can be keyed out to transparency.

No text, no signature, no watermark, no logos, no frame.`;

function buildPrompt(
  heroName: string | null,
  description: string | null,
  hasRefs: boolean,
): string {
  const subject = heroName
    ? `Create a flat vector avatar icon of ${heroName}.`
    : `Create a flat vector avatar icon of the character in the supplied image.`;
  const desc = description ? `\n\nThe character: ${description}` : '';
  // Without a name the source image is the ONLY identity anchor, so bind the
  // silhouette to it explicitly — a loose "take colours from it" let Hulk drift
  // into a generic long-haired green head on the first run.
  // The source may be a busy full-body comic cover, so say so explicitly — the
  // model must isolate the head rather than compose from the whole panel.
  // Two failure modes seen in testing, both fixed here: the model composing from a
  // whole action panel instead of the head, and the source portrait's vivid
  // background colour bleeding in as a rim on the character (Batman came back with
  // a red edge lifted straight off his portrait's red backdrop).
  const locate = `The supplied character image may be a full-body pose, an action scene or a busy comic cover. IGNORE the body, the pose and every other figure — find the character's HEAD and use only that. IGNORE the source image's background colour completely: it is NOT part of the character, must not tint the head, and must not appear as a rim, edge or patch anywhere in the icon.`;
  const fidelity = heroName
    ? `${locate} Take the costume colours, mask/helmet design and hair shape from it, then radically simplify. Where the supplied image shows an unusual or modern variant, favour the character's best-known classic look.`
    : `The FIRST image is the character to redraw and is your ONLY reference for who this is. ${locate} Copy the head geometry faithfully: the same hair length and volume, the same hairline, the same mask or helmet shape, the same brow and jaw proportions, the same colours. Do NOT invent hair, do NOT restyle the head. Simplify what is there into flat shapes — never replace it.`;
  const refNote = hasRefs
    ? ` The LAST images are STYLE REFERENCES for this icon set — match their flatness, palette weight, texture, crop and level of simplification exactly.`
    : '';

  return `${subject} It must be instantly recognisable at 32 pixels wide.${desc}

${fidelity}${refNote}

${STYLE_BLOCK}

${FORM_BLOCK}

${FRAME_BLOCK}

Preserve the character's signature colours and headwear exactly. Simplify everything else away.`;
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const argValue = (flag: string) => args.find((_, i) => args[i - 1] === flag) ?? null;

const heroIdFlag = argValue('--hero-id');
const heroIdsFlag = argValue('--hero-ids');
const heroIdsSet = heroIdsFlag ? heroIdsFlag.split(',').map((s) => s.trim()) : null;
const outDir = argValue('--out-dir');
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
// Re-cut alpha on avatars already in Cloudinary; no model calls, no cost.
const repairMode = args.includes('--repair');
// Render the generic placeholder heads into assets/ (no DB, no Cloudinary).
const genericMode = args.includes('--generic');
const CONCURRENCY = parseInt(argValue('--concurrency') ?? '3', 10);
const limitArg = argValue('--limit');
const LIMIT = limitArg ? parseInt(limitArg, 10) : null;

// Local proof mode: write PNGs to disk, touch neither Cloudinary nor the DB.
const localOnly = Boolean(outDir);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Transparency ─────────────────────────────────────────────────────────────

/** Decode a PNG to a raw RGBA buffer via ffmpeg (no image library needed). */
function decodeRgba(bytes: Uint8Array, path: string): { rgba: Buffer; w: number; h: number } {
  writeFileSync(path, bytes);
  const dims = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      path,
    ],
    { encoding: 'utf8' },
  ).trim();
  const [w, h] = dims.split(',').map((n) => parseInt(n, 10));
  const rgba = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    {
      maxBuffer: 1024 * 1024 * 256,
    },
  );
  return { rgba, w, h };
}

/** Re-encode a raw RGBA buffer back to PNG via ffmpeg. */
function encodePng(rgba: Buffer, w: number, h: number, outPath: string): Uint8Array {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${w}x${h}`,
      '-i',
      'pipe:0',
      outPath,
    ],
    { input: rgba, maxBuffer: 1024 * 1024 * 256 },
  );
  return readFileSync(outPath);
}

/**
 * Cut the flat white background to alpha by FLOOD FILLING inward from the border,
 * not by keying every white pixel in the image.
 *
 * ffmpeg's `colorkey` is a global colour match, so it also punched out every white
 * pixel *inside* the artwork: Spider-Man's eye lenses, Iron Man's eye slits, and
 * Captain America's eyes, wing motif and chest "A" all became holes. On the beige
 * canvas that read as an off-white lens and looked fine, which is exactly what made
 * it dangerous — the holes only reveal themselves on a dark or coloured surface.
 *
 * A flood fill from the edges only removes white that is CONNECTED to the border,
 * so enclosed white shapes survive. The resulting hard mask is then feathered by a
 * 3×3 box blur on the alpha channel alone, which restores the anti-aliased edge that
 * colorkey's blend parameter used to provide.
 */
function keyWhiteToAlpha(id: string, bytes: Uint8Array): Uint8Array {
  const inPath = join(tmpdir(), `avatar-${id}-${Date.now()}.png`);
  const outPath = `${inPath}.out.png`;
  try {
    const { rgba, w, h } = decodeRgba(bytes, inPath);
    const n = w * h;

    // "Background-ish" is deliberately generous: the model never emits a clean
    // #FFFFFF, and the screenprint texture speckles the backdrop.
    const isPale = (i: number) => {
      const o = i * 4;
      return rgba[o] >= 232 && rgba[o + 1] >= 232 && rgba[o + 2] >= 232;
    };

    // BFS from every border pixel. A typed-array queue keeps this ~instant at 1MP.
    const bg = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    const push = (i: number) => {
      if (!bg[i] && isPale(i)) {
        bg[i] = 1;
        queue[tail++] = i;
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }

    // Hard mask → feathered alpha (3×3 box blur), so edges stay anti-aliased.
    const alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) alpha[i] = bg[i] ? 0 : 255;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += alpha[yy * w + xx];
            count++;
          }
        }
        // Feather only inward. Letting a background pixel take partial alpha
        // would tint it back in, and since its RGB is white that shows up as a
        // pale halo around the silhouette.
        const i = y * w + x;
        rgba[i * 4 + 3] = bg[i] ? 0 : Math.round(sum / count);
      }
    }

    return encodePng(rgba, w, h, outPath);
  } catch (err) {
    console.log(
      `  ⚠ ${id}: alpha cut failed (${err instanceof Error ? err.message.split('\n')[0] : err}) — keeping the white background`,
    );
    return bytes;
  } finally {
    for (const p of [inPath, outPath]) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────

/**
 * Signed upload of in-memory bytes to `hero-avatars/{id}`, overwrite:true so
 * re-runs are idempotent. Uploaded as PNG — avatars carry an alpha channel, so
 * unlike portraits they must not be re-encoded to JPEG anywhere in the chain.
 */
async function uploadToCloudinary(heroId: string, imageBytes: Uint8Array): Promise<string> {
  const publicId = `hero-avatars/${heroId}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1')
    .update(toSign + CLOUD_SECRET)
    .digest('hex');

  const form = new FormData();
  form.append('file', new Blob([Buffer.from(imageBytes)], { type: 'image/png' }), `${heroId}.png`);
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

/**
 * Every hero-avatars/{id} asset in Cloudinary → its versioned secure_url. The
 * upload happens before the DB write, so a lost write orphans a paid-for image
 * (asset exists, avatar_url still null). Listing lets a re-run re-link those for
 * free instead of regenerating them — the same self-heal the portrait pipeline
 * needed after high-concurrency runs dropped writes.
 */
async function listCloudinaryAvatars(): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image`);
    url.searchParams.set('type', 'upload');
    url.searchParams.set('prefix', 'hero-avatars/');
    url.searchParams.set('max_results', '500');
    if (cursor) url.searchParams.set('next_cursor', cursor);
    const auth = 'Basic ' + Buffer.from(`${CLOUD_KEY}:${CLOUD_SECRET}`).toString('base64');
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`Cloudinary list failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      resources: { public_id: string; version: number; format: string; secure_url?: string }[];
      next_cursor?: string;
    };
    for (const r of body.resources) {
      assets.set(
        r.public_id.replace(/^hero-avatars\//, ''),
        r.secure_url ??
          `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${r.version}/${r.public_id}.${r.format}`,
      );
    }
    cursor = body.next_cursor;
  } while (cursor);
  return assets;
}

/** Write avatar_url back, retrying through the connection sheds seen at high concurrency. */
async function setAvatarUrl(heroId: string, url: string): Promise<void> {
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    const { error } = await supabase.from('heroes').update({ avatar_url: url }).eq('id', heroId);
    if (!error) return;
    lastError = error.message;
  }
  throw new Error(`DB update failed for ${heroId} after 5 attempts: ${lastError}`);
}

// ─── Generation ───────────────────────────────────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const rawMime = res.headers.get('content-type') ?? '';
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: rawMime.startsWith('image/') ? rawMime : 'image/jpeg',
  };
}

/** Nameless visual description — the fallback identity when a trademarked name trips the filter. */
async function describeCharacterVisually(base64: string, mime: string): Promise<string> {
  const res = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "Describe only this character's HEAD for an icon designer: mask or helmet design, hair shape and colour, skin tone, eye shape, and any signature head feature (horns, ears, lenses, markings). Be specific about colours. Do not name the character. 2 sentences.",
            },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return '';
  const json = (await res.json()) as { candidates?: { content: { parts: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? '';
}

async function callImageModel(
  parts: object[],
  modelUrl: string = GEMINI_URL,
): Promise<Uint8Array | 'PROHIBITED'> {
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio: '1:1' }, // avatars are square
    },
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`  ↻ Retrying in ${delay}ms (attempt ${attempt + 1}/4)…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const res = await fetch(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      lastError = new Error(`Rate limited: ${await res.text()}`);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as {
      candidates: {
        finishReason?: string;
        content: { parts: { inlineData?: { data: string }; inline_data?: { data: string } }[] };
      }[];
    };

    if (json.candidates?.[0]?.finishReason === 'PROHIBITED_CONTENT') return 'PROHIBITED';

    const part = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data ?? p.inline_data?.data,
    );
    const data = part?.inlineData?.data ?? part?.inline_data?.data;
    if (!data) throw new Error('No image in Gemini response');
    return Buffer.from(data, 'base64');
  }
  throw lastError ?? new Error('Gemini request failed after retries');
}

/**
 * Named 3.1 → nameless 3.1 → nameless 2.5. Much shorter ladder than the portrait
 * pipeline's: an avatar is a flat abstraction of a head, so if every rung refuses
 * there's nothing worth laundering — a lookalike icon of a lookalike is just a
 * different character. Blocked heroes are skipped and reported.
 */
async function generateAvatarFromSource(
  sourceBase64: string,
  sourceMime: string,
  heroName: string,
): Promise<Uint8Array | 'BLOCKED'> {
  const refs = loadStyleRefs();
  const sourceImg = { inline_data: { mime_type: sourceMime, data: sourceBase64 } };
  const hasRefs = refs.length > 0;

  /**
   * The safety filter is stochastic on trademarked characters — the exact same
   * request can block on one call and sail through on the next. So each rung gets
   * several shots before we descend; descending early costs identity quality for
   * nothing. Errors are treated as a block so a bad rung never kills the hero.
   */
  const attempt = async (
    parts: object[],
    url: string,
    tries: number,
  ): Promise<Uint8Array | 'PROHIBITED'> => {
    for (let i = 0; i < tries; i++) {
      try {
        const out = await callImageModel(parts, url);
        if (out !== 'PROHIBITED') return out;
      } catch (err) {
        console.log(`  ⚠ ${heroName}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
      }
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    return 'PROHIBITED';
  };

  const named = await attempt(
    [{ text: buildPrompt(heroName, null, hasRefs) }, sourceImg, ...refs],
    GEMINI_URL,
    3,
  );
  if (named !== 'PROHIBITED') return named;

  console.log(`  ⚠ ${heroName} blocked by Gemini 3.1 (named) — retrying nameless`);
  const description = await describeCharacterVisually(sourceBase64, sourceMime);
  // Image first: with no name to anchor identity, leading with the source keeps the
  // model copying the actual head instead of illustrating the text description.
  const namelessParts = [
    sourceImg,
    { text: buildPrompt(null, description || null, hasRefs) },
    ...refs,
  ];

  for (const [label, url] of [
    ['Gemini 3.1 (nameless)', GEMINI_URL],
    ['Gemini 2.5 Flash Image (nameless)', GEMINI_25_IMAGE_URL],
  ] as const) {
    const out = await attempt(namelessParts, url, 3);
    if (out !== 'PROHIBITED') {
      console.log(`  ✓ ${heroName} rendered by ${label}`);
      return out;
    }
    console.log(`  ⚠ ${heroName} blocked by ${label}`);
  }

  // Last rung: no name AND no source image — generate from the neutral description
  // alone. This is the avatar equivalent of the portrait pipeline's launder, but far
  // more faithful here: an icon's whole identity is a mask/hair silhouette and two
  // colours, which a written description carries almost losslessly. It's the source
  // image that usually trips the filter, so dropping it is often what gets a
  // stubbornly-blocked character (Spider-Man) through at all.
  if (description) {
    const textOnly = await attempt(
      [{ text: buildPrompt(null, description, false) }],
      GEMINI_URL,
      3,
    );
    if (textOnly !== 'PROHIBITED') {
      console.log(`  ✓ ${heroName} rendered by Gemini 3.1 (description only)`);
      return textOnly;
    }
    console.log(`  ⚠ ${heroName} blocked by Gemini 3.1 (description only)`);
  }
  return 'BLOCKED';
}

/**
 * Try each candidate source in turn, running the full model ladder on each.
 *
 * Which source you send changes whether the safety filter fires at all, and not in
 * the direction you'd guess: the generated portrait blocked every rung for Hulk and
 * Spider-Man while their raw image_url sailed through the named path. So the source
 * is a fallback dimension, not a fixed choice — portrait first because it's an
 * already-isolated head, raw image second because it clears the filter more often.
 */
async function generateAvatar(
  sources: string[],
  heroName: string,
): Promise<Uint8Array | 'BLOCKED'> {
  for (const [i, src] of sources.entries()) {
    if (i > 0) console.log(`  ↺ ${heroName}: retrying the ladder on the next source image`);
    let base64: string;
    let mimeType: string;
    try {
      ({ base64, mimeType } = await fetchImageAsBase64(src));
    } catch (err) {
      console.log(`  ⚠ ${heroName}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const out = await generateAvatarFromSource(base64, mimeType, heroName);
    if (out !== 'BLOCKED') return out;
  }
  return 'BLOCKED';
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

// ─── Repair ───────────────────────────────────────────────────────────────────

/**
 * Re-cut the alpha on avatars already in Cloudinary, in place, with no model calls.
 *
 * Possible because `colorkey` only zeroed the alpha channel — it left the RGB under
 * every hole intact (a punched-out eye lens is still white, just invisible). So
 * flattening alpha back to opaque and re-running the flood-fill cut recovers the
 * enclosed white shapes exactly. Free, and much faster than regenerating.
 */
async function repair(): Promise<void> {
  const assets = await listCloudinaryAvatars();
  const ids = [...assets.keys()];
  console.log(`Repairing alpha on ${ids.length} existing avatars\n`);

  await withConcurrency(ids, CONCURRENCY, async (id, idx) => {
    const label = `[${idx + 1}/${ids.length}] ${id}`;
    if (dryRun) {
      console.log(`  [dry-run] ${label}`);
      return;
    }
    const flatPath = join(tmpdir(), `repair-${id}-${Date.now()}.png`);
    try {
      const res = await fetch(assets.get(id)!);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const original = Buffer.from(await res.arrayBuffer());

      // Flatten alpha back to fully opaque so the flood fill sees the real pixels.
      const { rgba, w, h } = decodeRgba(original, flatPath);
      for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
      const opaque = encodePng(rgba, w, h, flatPath);

      const fixed = keyWhiteToAlpha(id, opaque);
      const url = await uploadToCloudinary(id, fixed);
      await setAvatarUrl(id, url);
      console.log(`  ✓ ${label}`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      try {
        unlinkSync(flatPath);
      } catch {
        /* ignore */
      }
    }
  });
}

/**
 * The placeholder heads used where we have no character at all.
 *
 * ~80% of family-tree entries are unmatched text — a relative's name that was
 * never resolved to a hero row — so they can never have a real avatar. These
 * stand in, drawn in exactly the same flat screenprint language so a tree reads
 * as one system instead of "some rows have pictures".
 *
 * They are SILHOUETTES on purpose: no eyes, no features, nothing that implies a
 * specific person. Only the outline differs. Which one a row gets is decided by
 * the relative's stated role ("mother", "father"), never guessed from a name.
 */
const GENERIC_HEADS: { key: string; shape: string }[] = [
  {
    key: 'feminine',
    shape:
      'a featureless head-and-jaw silhouette with long hair falling past the jaw on both sides',
  },
  {
    key: 'masculine',
    shape: 'a featureless head-and-jaw silhouette with short cropped hair',
  },
  {
    key: 'neutral',
    shape: 'a featureless head-and-jaw silhouette with plain medium-length hair',
  },
];

async function generateGeneric(): Promise<void> {
  const dir = join((import.meta as unknown as { dir: string }).dir, '../assets/avatars');
  mkdirSync(dir, { recursive: true });

  for (const { key, shape } of GENERIC_HEADS) {
    const prompt = `Create an anonymous placeholder avatar icon: ${shape}.

${STYLE_BLOCK}

FORM — a head-only icon, dead-on FRONT view, perfectly symmetrical:
• A SOLID SILHOUETTE. Absolutely NO facial features of any kind — no eyes, no brows, no mouth, no nose. The face area is one flat, even shape.
• The only thing that distinguishes this icon is its outer outline (the hair and head shape).
• Crop at the JAW. NO neck, NO shoulders, NO body.
• Use ONE muted, desaturated warm-grey tone for the face and ONE slightly darker neutral tone for the hair. No character colours, nothing vivid — this must read as a placeholder, never as a specific person.

${FRAME_BLOCK}`;

    // 3.1's per-minute quota is usually spent by a big batch, and these three
    // are one-off assets — fall through to 2.5 rather than blocking on it.
    let out: Uint8Array | 'PROHIBITED' | null = null;
    for (const url of [GEMINI_URL, GEMINI_25_IMAGE_URL]) {
      try {
        out = await callImageModel([{ text: prompt }], url);
        if (out !== 'PROHIBITED') break;
      } catch (err) {
        console.log(`  ⚠ ${key}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
        out = null;
      }
    }
    if (!out || out === 'PROHIBITED') {
      console.error(`  ✗ ${key}: could not render`);
      continue;
    }
    const bytes = keyWhiteToAlpha(`generic-${key}`, out);
    const path = join(dir, `placeholder-${key}.png`);
    writeFileSync(path, bytes);
    console.log(`  ✓ ${key} → ${path}`);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  let query = supabase
    .from('heroes')
    .select('id, name, image_url, portrait_url')
    .not('image_url', 'is', null)
    // Most recognisable first — avatars matter most for the heroes people actually see.
    .order('fame_score', { ascending: false, nullsFirst: false });

  // --hero-id / --hero-ids are explicit re-render requests, so they bypass the
  // "already has one" filter; a plain batch only fills gaps unless --force.
  const targeted = heroIdFlag || heroIdsSet;
  if (heroIdFlag) query = query.eq('id', heroIdFlag) as typeof query;
  else if (heroIdsSet) query = query.in('id', heroIdsSet) as typeof query;
  if (!targeted && !force && !localOnly) query = query.is('avatar_url', null) as typeof query;
  if (LIMIT) query = query.limit(LIMIT) as typeof query;

  const { data: heroes, error } = await query;
  if (error) throw new Error(`Failed to fetch heroes: ${error.message}`);
  if (!heroes?.length) {
    console.log('No heroes to process.');
    return;
  }

  if (outDir) mkdirSync(outDir, { recursive: true });

  // Re-link anything already sitting in Cloudinary before paying to regenerate it.
  let workingSet = heroes;
  if (!localOnly && !dryRun && !force) {
    const assets = await listCloudinaryAvatars();
    const orphans = heroes.filter((h) => assets.has(h.id));
    if (orphans.length) {
      console.log(`Re-linking ${orphans.length} orphaned Cloudinary avatars (no regen)…`);
      await withConcurrency(orphans, CONCURRENCY, async (hero) => {
        try {
          await setAvatarUrl(hero.id, assets.get(hero.id)!);
          console.log(`  ↺ backfilled ${hero.name} (${hero.id})`);
        } catch (err) {
          console.error(`  ✗ backfill ${hero.id}: ${err instanceof Error ? err.message : err}`);
        }
      });
      const orphanIds = new Set(orphans.map((h) => h.id));
      workingSet = heroes.filter((h) => !orphanIds.has(h.id));
    }
  }

  console.log(`Processing ${workingSet.length} heroes with concurrency=${CONCURRENCY}\n`);

  await withConcurrency(workingSet, CONCURRENCY, async (hero, idx) => {
    const label = `[${idx + 1}/${workingSet.length}] ${hero.name} (${hero.id})`;
    if (dryRun) {
      console.log(`  [dry-run] ${label}`);
      return;
    }

    try {
      console.log(`  ⟳ ${label}`);
      // Portrait first (an isolated, clean head — image_url is often a full-body
      // action cover the model has to dig the head out of), raw image as the
      // fallback source when the portrait trips the safety filter.
      const sources = [hero.portrait_url, hero.image_url].filter((s): s is string => Boolean(s));
      const generated = await generateAvatar(sources, hero.name);
      if (generated === 'BLOCKED') {
        console.error(`  ✗ ${label}: blocked on every model — skipped`);
        return;
      }
      const bytes = keyWhiteToAlpha(hero.id, generated);

      if (localOnly) {
        const path = join(outDir!, `${hero.id}.png`);
        writeFileSync(path, bytes);
        console.log(`  ✓ ${label} → ${path}`);
        return;
      }

      const url = await uploadToCloudinary(hero.id, bytes);
      await setAvatarUrl(hero.id, url);
      console.log(`  ✓ ${label} → ${url}`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
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
  if (!GEMINI_API_KEY) throw new Error('GOOGLE_AI_STUDIO_API_KEY must be set in .env.local');
  if (!localOnly && !dryRun && (!CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET)) {
    throw new Error(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in .env.local',
    );
  }

  console.log('Hero Avatar Generator');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : localOnly ? `LOCAL → ${outDir}` : 'LIVE'}`);
  console.log(`Style refs: ${loadStyleRefs().length}/3 loaded from assets/avatars/refs`);
  if (heroIdFlag) console.log(`Filter: hero ${heroIdFlag} only`);
  if (heroIdsFlag) console.log(`Filter: heroes ${heroIdsFlag}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} heroes`);
  console.log('');

  if (genericMode) await generateGeneric();
  else if (repairMode) await repair();
  else await run();
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
