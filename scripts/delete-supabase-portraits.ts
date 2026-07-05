#!/usr/bin/env bun
/**
 * Delete all files in the hero-portraits Supabase Storage bucket.
 * Safe to run after migrate-portraits-to-cloudinary.ts completes — all DB rows
 * should already point at Cloudinary before running this.
 *
 * Usage:
 *   bun scripts/delete-supabase-portraits.ts --dry-run   # preview count
 *   bun scripts/delete-supabase-portraits.ts             # delete for real
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUCKET = 'hero-portraits';
const DRY_RUN = process.argv.includes('--dry-run');

async function listAll(): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.storage.from(BUCKET).list('', {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list: ${error.message}`);
    if (!data?.length) break;
    paths.push(...data.map((f) => f.name));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return paths;
}

async function main() {
  // Guard: verify no DB rows still point at Supabase Storage.
  const { error: checkErr } = await sb
    .from('heroes')
    .select('id', { count: 'exact', head: true })
    .like('portrait_url', '%supabase.co/storage%');
  if (checkErr) throw new Error(`safety check: ${checkErr.message}`);
  const { count } = await sb
    .from('heroes')
    .select('*', { count: 'exact', head: true })
    .like('portrait_url', '%supabase.co/storage%');
  if ((count ?? 0) > 0) {
    console.error(
      `ABORT: ${count} heroes still reference Supabase Storage. Run the migration first.`,
    );
    process.exit(1);
  }

  const files = await listAll();
  console.log(`Found ${files.length} files in bucket "${BUCKET}".`);

  if (DRY_RUN) {
    console.log('DRY RUN — no files deleted.');
    files.slice(0, 5).forEach((f) => console.log(`  would delete: ${f}`));
    if (files.length > 5) console.log(`  … and ${files.length - 5} more.`);
    return;
  }

  // Storage.remove accepts up to 1000 paths at a time.
  const BATCH = 1000;
  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const { error } = await sb.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error(`  batch ${i}–${i + batch.length}: ${error.message}`);
      failed += batch.length;
    } else {
      deleted += batch.length;
    }
    console.log(`  ${Math.min(i + BATCH, files.length)} of ${files.length} processed`);
  }

  console.log(`\nDone. Deleted ${deleted}, failed ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
