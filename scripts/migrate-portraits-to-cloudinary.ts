#!/usr/bin/env bun
/**
 * Migrate Supabase-hosted hero portraits to Cloudinary.
 *
 * For each hero whose portrait_url points at Supabase Storage:
 *   1. Download the original to ./portrait-backup/{id}.jpg (local safety net).
 *   2. Upload to Cloudinary public_id `hero-portraits/{id}` (overwrite:false).
 *   3. Flip heroes.portrait_url to the returned Cloudinary secure_url.
 *
 * Idempotent + resumable: existing backup files and already-Cloudinary rows are
 * skipped, so re-running continues where it left off. Rows flip individually, so
 * there is no broken intermediate state.
 *
 * Usage:
 *   bun scripts/migrate-portraits-to-cloudinary.ts --dry-run            # preview
 *   bun scripts/migrate-portraits-to-cloudinary.ts --limit 10           # first 10
 *   bun scripts/migrate-portraits-to-cloudinary.ts --concurrency 8      # full run
 */
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import pLimit from 'p-limit';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) {
  console.error(
    'Missing env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
  );
  process.exit(1);
}

cloudinary.config({ cloud_name: CLOUD_NAME, api_key: CLOUD_KEY, api_secret: CLOUD_SECRET });
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const arg = (flag: string): string | null =>
  process.argv.includes(flag) ? (process.argv[process.argv.indexOf(flag) + 1] ?? null) : null;
const has = (flag: string) => process.argv.includes(flag);

const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : Infinity;
const CONCURRENCY = arg('--concurrency') ? parseInt(arg('--concurrency')!, 10) : 8;
const DRY_RUN = has('--dry-run');

const BACKUP_DIR = './portrait-backup';

type Row = { id: string; portrait_url: string };

/** Page through every Supabase-hosted portrait (table exceeds the 1000-row cap). */
async function fetchAllRows(): Promise<Row[]> {
  const PAGE = 1000;
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('heroes')
      .select('id, portrait_url')
      .like('portrait_url', '%supabase.co/storage%')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return all;
}

async function backup(id: string, url: string): Promise<void> {
  const path = `${BACKUP_DIR}/${id}.jpg`;
  if (existsSync(path)) return; // resumable: already backed up
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
}

async function migrate(row: Row): Promise<'migrated' | 'failed'> {
  try {
    await backup(row.id, row.portrait_url);
    // overwrite:false → if the asset already exists, Cloudinary returns it (no re-upload).
    const result = await cloudinary.uploader.upload(`${BACKUP_DIR}/${row.id}.jpg`, {
      public_id: `hero-portraits/${row.id}`,
      overwrite: false,
    });
    const { error } = await sb
      .from('heroes')
      .update({ portrait_url: result.secure_url })
      .eq('id', row.id);
    if (error) throw new Error(`db: ${error.message}`);
    return 'migrated';
  } catch (err) {
    console.error(`  ✗ ${row.id}:`, err instanceof Error ? err.message : err);
    return 'failed';
  }
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const rows = (await fetchAllRows()).slice(0, LIMIT);
  console.log(`Found ${rows.length} Supabase-hosted portraits to migrate.`);

  if (DRY_RUN) {
    console.log('DRY RUN — no downloads, uploads, or DB writes.');
    rows.slice(0, 5).forEach((r) => console.log(`  would migrate ${r.id} ← ${r.portrait_url}`));
    console.log(`… and ${Math.max(0, rows.length - 5)} more.`);
    return;
  }

  const limit = pLimit(CONCURRENCY);
  let migrated = 0;
  let failed = 0;
  let done = 0;
  const failedIds: string[] = [];

  await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const outcome = await migrate(row);
        done += 1;
        if (outcome === 'migrated') migrated += 1;
        else {
          failed += 1;
          failedIds.push(row.id);
        }
        if (done % 50 === 0 || done === rows.length) {
          console.log(`  ${done} of ${rows.length} (migrated ${migrated}, failed ${failed})`);
        }
      }),
    ),
  );

  console.log(`\nDone. Migrated ${migrated}, failed ${failed}.`);
  if (failedIds.length) console.log('Failed ids:', failedIds.join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
