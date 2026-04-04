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
const GEMINI_MODEL = 'gemini-2.0-flash-preview-image-generation';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Style reference: the Spider-Man Mike Mitchell portrait
const STYLE_REF_PATH = join((import.meta as unknown as { dir: string }).dir, '../assets/images/spiderman.jpg');

const STYLE_PROMPT = `Redraw the character from the first image as a side-profile bust portrait \
in exactly the style of the second reference image: flat graphic illustration, bold solid \
background colour, simplified clean shapes, head and shoulders crop, smooth flat shading \
with subtle gradients, clean outlines, poster art aesthetic. \
Preserve the character's costume colours and identity. Do not include any text.`;

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

// ─── Supabase client (service role — write access to Storage) ─────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadToStorage(heroId: string, imageBytes: Uint8Array): Promise<string> {
  const fileName = `${heroId}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, imageBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed for ${heroId}: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

async function setPortraitUrl(heroId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from('heroes')
    .update({ portrait_url: url })
    .eq('id', heroId);
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
): Promise<Uint8Array> {
  const styleRefBytes = readFileSync(STYLE_REF_PATH);
  const styleRefBase64 = styleRefBytes.toString('base64');

  const body = {
    contents: [{
      parts: [
        { text: `Character name: ${heroName}. ${STYLE_PROMPT}` },
        { inline_data: { mime_type: sourceMime, data: sourceBase64 } },
        { inline_data: { mime_type: 'image/jpeg', data: styleRefBase64 } },
      ],
    }],
    generationConfig: {
      responseModalities: ['image', 'text'],
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
      lastError = new Error('Rate limited');
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const json = await res.json() as {
      candidates: Array<{
        content: { parts: Array<{ inline_data?: { data: string } }> }
      }>
    };

    const imagePart = json.candidates?.[0]?.content?.parts?.find((p) => p.inline_data?.data);
    if (!imagePart?.inline_data?.data) throw new Error('No image in Gemini response');

    return Buffer.from(imagePart.inline_data.data, 'base64');
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
      const imageBytes = await generatePortrait(base64, mimeType, hero.name);
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
    throw new Error('EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  }
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY must be set in .env.local');
  }

  console.log(`Hero Portrait Generator`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (heroIdFlag) console.log(`Filter: hero ${heroIdFlag} only`);

  // Phase 1 only runs when not filtering to a single hero
  if (!heroIdFlag) await phase1();
  await phase2(heroIdFlag ?? undefined);

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
