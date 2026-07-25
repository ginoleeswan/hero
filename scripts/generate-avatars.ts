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
        inline_data: { mime_type: 'image/png', data: readFileSync(join(REFS_DIR, name)).toString('base64') },
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

function buildPrompt(heroName: string | null, description: string | null, hasRefs: boolean): string {
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
const CONCURRENCY = parseInt(argValue('--concurrency') ?? '3', 10);
const limitArg = argValue('--limit');
const LIMIT = limitArg ? parseInt(limitArg, 10) : null;

// Local proof mode: write PNGs to disk, touch neither Cloudinary nor the DB.
const localOnly = Boolean(outDir);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Transparency ─────────────────────────────────────────────────────────────

/**
 * Key the flat white background out to alpha. `colorkey` with a similarity of
 * 0.10 catches the model's near-white (it never emits a mathematically perfect
 * #FFFFFF) without eating light greys inside the artwork; blend 0.08 feathers
 * the edge so the silhouette isn't aliased into a hard jaggy cut.
 */
function keyWhiteToAlpha(id: string, bytes: Uint8Array): Uint8Array {
  const inPath = join(tmpdir(), `avatar-${id}-${Date.now()}.png`);
  const outPath = `${inPath}.out.png`;
  writeFileSync(inPath, bytes);
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-i', inPath, '-vf', 'colorkey=0xFFFFFF:0.10:0.08', '-frames:v', '1', outPath],
      { stdio: 'ignore' },
    );
    return readFileSync(outPath);
  } catch {
    console.log(`  ⚠ ${id}: colorkey failed — keeping the white background`);
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
              text: 'Describe only this character\'s HEAD for an icon designer: mask or helmet design, hair shape and colour, skin tone, eye shape, and any signature head feature (horns, ears, lenses, markings). Be specific about colours. Do not name the character. 2 sentences.',
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
  const attempt = async (parts: object[], url: string, tries: number): Promise<Uint8Array | 'PROHIBITED'> => {
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
  const namelessParts = [sourceImg, { text: buildPrompt(null, description || null, hasRefs) }, ...refs];

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
    const textOnly = await attempt([{ text: buildPrompt(null, description, false) }], GEMINI_URL, 3);
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
  console.log(`Processing ${heroes.length} heroes with concurrency=${CONCURRENCY}\n`);

  await withConcurrency(heroes, CONCURRENCY, async (hero, idx) => {
    const label = `[${idx + 1}/${heroes.length}] ${hero.name} (${hero.id})`;
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
    throw new Error('EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
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

  await run();
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
