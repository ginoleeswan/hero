#!/usr/bin/env bun
/**
 * Hero portrait generation script.
 *
 * Phase 1: Upload the 34 existing curated local images to Supabase Storage.
 * Phase 2: For each remaining hero (portrait_url IS NULL), fetch their API
 *          image, send it + spiderman.jpg to Gemini 2.0 Flash for style
 *          transfer, upload result to Supabase Storage, and write portrait_url
 *          back to the DB.
 *
 * Usage:
 *   bun scripts/generate-portraits.ts               # full batch
 *   bun scripts/generate-portraits.ts --hero-id 69  # single hero (test)
 *   bun scripts/generate-portraits.ts --dry-run     # log without API calls
 *   bun scripts/generate-portraits.ts --concurrency 5
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY!;

const BUCKET = 'hero-portraits';
const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Style references — Wolverine, Deadpool, Thor: best painterly texture examples (v4 proven)
const ASSETS_DIR = join((import.meta as unknown as { dir: string }).dir, '../assets/images');
const STYLE_REF_PATHS = [
  join(ASSETS_DIR, 'wolverine.jpg'),
  join(ASSETS_DIR, 'deadpool.jpg'),
  join(ASSETS_DIR, 'thor.jpg'),
];

// Vivid background colours cycled by hero ID to ensure variety across portraits
const BG_PALETTE = [
  'vivid red',
  'vivid orange',
  'vivid yellow',
  'vivid cobalt blue',
  'vivid teal',
  'vivid purple',
  'vivid hot pink',
  'vivid lime green',
  'vivid crimson',
  'vivid sky blue',
];

function bgColorForHero(heroId: string): string {
  const idx = parseInt(heroId, 10) % BG_PALETTE.length;
  return BG_PALETTE[idx];
}

function buildPrompt(heroId: string): string {
  const bgColor = bgColorForHero(heroId);
  return `The first image is the character to redraw. Images 2, 3, and 4 are style reference illustrations — study every detail and match the style exactly.

Redraw the character from image 1 as a strict pure side-profile portrait facing RIGHT (nose pointing right, pure 90-degree side view, exactly as in the references).

RENDERING: Painterly digital illustration — rich dimensional depth, visible surface quality. Skin has warm highlights, cool shadows, subtle colour variation. Costume materials feel real: fabric has texture, metal has sheen, leather has gloss. Exactly like the references — NOT flat vector, NOT plain cartoon.

BACKGROUND: ${bgColor} — bold, vivid, and dominant. Slightly painterly texture, like a brushed wall or canvas, matching the style of the reference images. No gradient fading into the character, no blending at the edges. Clearly distinct from the character with a strong outline separating them.

FRAMING: This is a HEADSHOT — the face and head fill the entire canvas. Think of a passport photo or a coin portrait — nothing but the face, with the very tops of the shoulders just barely visible at the bottom edge. The chin should be roughly 15% from the bottom of the image, the top of the head 10% from the top. Zero chest, zero torso. Portrait orientation (taller than wide).

OUTLINE: Clean strong outline separating character from background.

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
const dryRun = args.includes('--dry-run');
const concurrencyArg = args.find((_, i) => args[i - 1] === '--concurrency');
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg, 10) : 3;
const limitArg = args.find((_, i) => args[i - 1] === '--limit');
const LIMIT = limitArg ? parseInt(limitArg, 10) : null;

// ─── Supabase client (service role — write access to Storage) ─────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadToStorage(heroId: string, imageBytes: Uint8Array): Promise<string> {
  const fileName = `${heroId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, imageBytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed for ${heroId}: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
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
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
  return { base64, mimeType };
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

  const body = {
    contents: [
      {
        parts: [
          { text: `Character name: ${heroName}. ${buildPrompt(heroId)}` },
          { inline_data: { mime_type: sourceMime, data: sourceBase64 } },
          ...styleRefs,
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
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
        content: {
          parts: Array<{ inlineData?: { data: string }; inline_data?: { data: string } }>;
        };
      }>;
    };

    const imagePart = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data ?? p.inline_data?.data,
    );
    const imageData = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
    if (!imageData) throw new Error('No image in Gemini response');

    return Buffer.from(imageData, 'base64');
  }
  throw lastError ?? new Error('Gemini request failed after retries');
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

// ─── Phase 1: Upload existing curated portraits ───────────────────────────────

async function phase1(): Promise<void> {
  console.log('\n═══ Phase 1: Uploading existing curated portraits ═══\n');

  const entries = Object.entries(LOCAL_PORTRAITS);
  for (const [heroId, relativePath] of entries) {
    // Check if already done
    const { data } = await supabase
      .from('heroes')
      .select('portrait_url, name')
      .eq('id', heroId)
      .single();

    if (data?.portrait_url) {
      console.log(`  ✓ ${data.name} (${heroId}) already uploaded — skipping`);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Would upload ${relativePath} for hero ${heroId}`);
      continue;
    }

    const absPath = join((import.meta as unknown as { dir: string }).dir, '..', relativePath);
    const bytes = readFileSync(absPath);
    const url = await uploadToStorage(heroId, new Uint8Array(bytes));
    await setPortraitUrl(heroId, url);
    console.log(`  ✓ ${data?.name ?? heroId} (${heroId}) → ${url}`);
  }
}

// ─── Phase 2: Generate AI portraits for remaining heroes ──────────────────────

async function phase2(filterHeroId?: string): Promise<void> {
  console.log('\n═══ Phase 2: Generating AI portraits ═══\n');

  let query = supabase
    .from('heroes')
    .select('id, name, image_url')
    .is('portrait_url', null)
    .not('image_url', 'is', null)
    .order('name');

  if (filterHeroId) {
    query = query.eq('id', filterHeroId) as typeof query;
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
      const url = await uploadToStorage(hero.id, imageBytes);
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

  console.log(`Hero Portrait Generator`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (heroIdFlag) console.log(`Filter: hero ${heroIdFlag} only`);
  if (LIMIT) console.log(`Limit: ${LIMIT} heroes`);

  // Phase 1 only runs when not filtering to a single hero
  if (!heroIdFlag) await phase1();
  await phase2(heroIdFlag ?? undefined);

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
