// supabase/functions/_shared/igdb-transform.ts
// Pure IGDB-character -> hero-row transform and dedup/re-home decision. One
// source of truth (no dual-path drift); no https/Deno imports so Jest can run it.

import { type FranchiseEntry, marqueeTier, normalizeName } from './igdb-allowlist.ts';

export interface IgdbCharacter {
  id: number;
  name: string;
  description?: string | null;
  mug_shot?: { image_id?: string } | null;
}

export interface ExistingRow {
  id: string;
  name: string;
  publisher: string | null;
  comicvine_id: string | null;
  igdb_id: string | null;
}

export interface NewHeroRow {
  id: string;
  name: string;
  igdb_id: string;
  igdb_status: 'enriched';
  publisher: string;
  franchise: string;
  summary: string | null;
  image_url: string | null;
  fame_tier: number;
  wikidata_status: 'pending';
  ai_stats_status: null;
  enriched_at: string;
}

export interface RehomePatch {
  igdb_id: string;
  igdb_status: 'enriched';
  publisher: string;
  franchise: string;
}

export type DedupDecision =
  | { kind: 'skip' }
  | { kind: 'insert'; row: NewHeroRow }
  | { kind: 'rehome'; targetId: string; patch: RehomePatch };

// Universes IGDB ingestion must never hijack via a name collision. A row under
// one of these with a comicvine_id is a comic character, not a game character.
export const PROTECTED_PUBLISHERS: Set<string> = new Set([
  'DC Comics', 'Marvel', 'Image', 'Dark Horse Comics', 'Archie Comics',
  'Valiant/Acclaim', 'Disney', 'Star Wars', 'Shueisha', 'Kodansha',
]);

export function mugShotUrl(imageId?: string | null): string | null {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_720p/${imageId}.jpg`;
}

export function characterToHeroRow(
  c: IgdbCharacter,
  entry: FranchiseEntry,
  now: string,
): NewHeroRow {
  return {
    id: `igdb-${c.id}`,
    name: c.name,
    igdb_id: String(c.id),
    igdb_status: 'enriched',
    publisher: entry.publisher,
    franchise: entry.franchise,
    summary: c.description ?? null,
    image_url: mugShotUrl(c.mug_shot?.image_id),
    fame_tier: marqueeTier(entry, c.name),
    wikidata_status: 'pending',
    ai_stats_status: null,
    enriched_at: now,
  };
}

function isProtected(row: ExistingRow): boolean {
  return !!row.comicvine_id && !!row.publisher && PROTECTED_PUBLISHERS.has(row.publisher);
}

export function dedupDecision(
  c: IgdbCharacter,
  entry: FranchiseEntry,
  existing: ExistingRow[],
  now: string,
): DedupDecision {
  const igdbId = String(c.id);
  if (existing.some((r) => r.igdb_id === igdbId)) return { kind: 'skip' };

  const norm = normalizeName(c.name);
  const candidates = existing.filter((r) => normalizeName(r.name) === norm);

  // Unambiguous, non-comic match -> re-home. Anything else (none, multiple, or a
  // protected comic character sharing the name) -> insert a fresh row.
  if (candidates.length === 1 && !isProtected(candidates[0])) {
    return {
      kind: 'rehome',
      targetId: candidates[0].id,
      patch: {
        igdb_id: igdbId,
        igdb_status: 'enriched',
        publisher: entry.publisher,
        franchise: entry.franchise,
      },
    };
  }
  return { kind: 'insert', row: characterToHeroRow(c, entry, now) };
}
