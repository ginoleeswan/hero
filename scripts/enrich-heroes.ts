// scripts/enrich-heroes.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.generated';

// Use service role key to bypass RLS for bulk enrichment writes.
// Add SUPABASE_SERVICE_ROLE_KEY to .env.local (never prefix with EXPO_PUBLIC_).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

const CDN_URL = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json';
const BATCH_SIZE = 50;

interface CdnHero {
  id: number;
  name: string;
  powerstats: {
    intelligence: number | null;
    strength: number | null;
    speed: number | null;
    durability: number | null;
    power: number | null;
    combat: number | null;
  };
  biography: {
    fullName: string;
    alterEgos: string;
    aliases: string[];
    placeOfBirth: string;
    firstAppearance: string;
    publisher: string;
    alignment: string;
  };
  appearance: {
    gender: string;
    race: string;
    height: [string, string];
    weight: [string, string];
    eyeColor: string;
    hairColor: string;
  };
  work: { occupation: string; base: string };
  connections: { groupAffiliation: string; relatives: string };
  images: { xs: string; sm: string; md: string; lg: string };
}

function mapHero(h: CdnHero) {
  return {
    id: String(h.id),
    name: h.name,
    image_url: h.images.lg,
    image_md_url: h.images.md,
    intelligence: h.powerstats.intelligence ?? null,
    strength: h.powerstats.strength ?? null,
    speed: h.powerstats.speed ?? null,
    durability: h.powerstats.durability ?? null,
    power: h.powerstats.power ?? null,
    combat: h.powerstats.combat ?? null,
    full_name: h.biography.fullName || null,
    alter_egos: h.biography.alterEgos || null,
    aliases: h.biography.aliases.filter(Boolean),
    place_of_birth: h.biography.placeOfBirth || null,
    first_appearance: h.biography.firstAppearance || null,
    publisher: h.biography.publisher || null,
    alignment: h.biography.alignment || null,
    gender: h.appearance.gender || null,
    race: h.appearance.race || null,
    height_imperial: h.appearance.height[0] || null,
    height_metric: h.appearance.height[1] || null,
    weight_imperial: h.appearance.weight[0] || null,
    weight_metric: h.appearance.weight[1] || null,
    eye_color: h.appearance.eyeColor || null,
    hair_color: h.appearance.hairColor || null,
    occupation: h.work.occupation || null,
    base: h.work.base || null,
    group_affiliation: h.connections.groupAffiliation || null,
    relatives: h.connections.relatives || null,
    enriched_at: new Date().toISOString(),
  };
}

async function main() {
  const targetId = process.argv.includes('--id')
    ? process.argv[process.argv.indexOf('--id') + 1]
    : null;

  console.log('Fetching CDN all.json...');
  const res = await fetch(CDN_URL);
  if (!res.ok) throw new Error(`CDN fetch failed: ${res.status}`);
  let heroes: CdnHero[] = await res.json();
  console.log(`Fetched ${heroes.length} heroes.`);

  if (targetId) {
    heroes = heroes.filter((h) => String(h.id) === targetId);
    if (heroes.length === 0) throw new Error(`Hero ${targetId} not found in CDN data`);
    console.log(`Filtered to hero ${targetId}: ${heroes[0].name}`);
  }

  const rows = heroes.map(mapHero);
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`Upserting ${rows.length} heroes in ${batches.length} batches...`);
  let done = 0;
  for (const batch of batches) {
    const { error } = await supabase
      .from('heroes')
      .upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    done += batch.length;
    console.log(`  ${done}/${rows.length} done`);
  }

  console.log('Enrichment complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
