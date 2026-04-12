// scripts/enrich-comicvine.ts
//
// Fetches ComicVine character data (summary, first-issue image) for every hero
// in the DB that hasn't been enriched yet, then writes back to Supabase.
//
// Usage:
//   npx ts-node --env-file .env.local scripts/enrich-comicvine.ts
//   npx ts-node --env-file .env.local scripts/enrich-comicvine.ts --force   # re-enrich all
//   npx ts-node --env-file .env.local scripts/enrich-comicvine.ts --id 620  # single hero
//
// ComicVine rate-limit: 200 req/h public key. We wait 20 s between heroes
// (~180/h) to stay well within the limit. A run over all 563 heroes takes
// roughly 3 h — run it overnight.
//
// The script is resumable: re-running it skips heroes where
// comicvine_enriched_at IS NOT NULL (unless --force is passed).

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.generated';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

const COMICVINE_KEY = process.env.COMICVINE_API_KEY!;
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';
const DELAY_MS = 20_000; // 20 s between requests → ~180/h

// ─── ComicVine API helpers ────────────────────────────────────────────────────

interface ComicVineCharacter {
  deck: string | null;
  publisher: { name: string } | null;
  first_appeared_in_issue: { id: number } | null;
}

interface ComicVineIssue {
  image: { medium_url: string } | null;
}

async function fetchCharacter(name: string): Promise<ComicVineCharacter | null> {
  const params = new URLSearchParams({
    api_key: COMICVINE_KEY,
    format: 'json',
    filter: `name:${name}`,
    field_list: 'deck,publisher,first_appeared_in_issue',
    limit: '1',
  });
  const res = await fetch(`${COMICVINE_BASE}/characters/?${params}`);
  if (!res.ok) throw new Error(`ComicVine /characters error: ${res.status}`);
  const json = await res.json();
  return (json.results?.[0] as ComicVineCharacter) ?? null;
}

async function fetchIssueImage(issueId: string): Promise<string | null> {
  const params = new URLSearchParams({
    api_key: COMICVINE_KEY,
    format: 'json',
    field_list: 'image',
  });
  const res = await fetch(`${COMICVINE_BASE}/issue/4000-${issueId}/?${params}`);
  if (!res.ok) {
    console.warn(`  ComicVine /issue/4000-${issueId} returned ${res.status} — skipping image`);
    return null;
  }
  const json = await res.json();
  const result = json.results as ComicVineIssue | null;
  return result?.image?.medium_url ?? null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const targetId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;

  if (!COMICVINE_KEY) {
    throw new Error('COMICVINE_API_KEY is not set in environment');
  }

  // Fetch heroes to enrich from Supabase
  let query = supabase.from('heroes').select('id, name').order('name');

  if (targetId) {
    query = query.eq('id', targetId) as typeof query;
  } else if (!force) {
    query = query.is('comicvine_enriched_at', null) as typeof query;
  }

  const { data: heroes, error } = await query;
  if (error) throw new Error(`Failed to fetch heroes: ${error.message}`);
  if (!heroes || heroes.length === 0) {
    console.log('No heroes to enrich.');
    return;
  }

  console.log(`Enriching ${heroes.length} hero${heroes.length !== 1 ? 's' : ''} via ComicVine…`);
  if (!force && !targetId) {
    console.log('(Use --force to re-enrich already-enriched heroes)');
  }

  let done = 0;
  let skipped = 0;

  for (const hero of heroes) {
    try {
      process.stdout.write(`[${done + skipped + 1}/${heroes.length}] ${hero.name}… `);

      const character = await fetchCharacter(hero.name);

      if (!character) {
        console.log('not found in ComicVine — skipping');
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      const summary = character.deck ?? null;
      const firstIssueId = character.first_appeared_in_issue?.id
        ? String(character.first_appeared_in_issue.id)
        : null;

      // Fetch first-issue image if we have an issue ID (costs a second request)
      let firstIssueImageUrl: string | null = null;
      if (firstIssueId) {
        await sleep(DELAY_MS);
        firstIssueImageUrl = await fetchIssueImage(firstIssueId);
      }

      const { error: upsertError } = await supabase
        .from('heroes')
        .update({
          summary,
          first_issue_image_url: firstIssueImageUrl,
          comicvine_enriched_at: new Date().toISOString(),
        })
        .eq('id', hero.id);

      if (upsertError) {
        console.log(`ERROR: ${upsertError.message}`);
      } else {
        console.log(summary ? 'done' : 'done (no summary)');
        done++;
      }
    } catch (e) {
      console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. Enriched: ${done}, skipped/failed: ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
