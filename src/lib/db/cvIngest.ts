import { supabase } from '../supabase';

export type GroupResource = 'team' | 'volume' | 'person' | 'movie' | 'publisher' | 'power';

// PostgREST caps URL length, so `.in()` over a big id list (publisher/power
// rosters run to thousands) must be chunked. 200 ids per query stays well clear.
const IN_CHUNK = 200;
function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export interface CvCharacter {
  id: string;
  name: string;
  publisher: string | null;
  image: string | null;
  deck: string | null;
  appearances?: number | null; // issue appearances (only on the 'popular' feed)
}

/** Rich detail for one character — backs the inline preview before adding. */
export interface CvCharacterDetail {
  id: string;
  name: string | null;
  realName: string | null;
  aliases: string[];
  deck: string | null;
  image: string | null;
  appearances: number | null;
  publisher: string | null;
  origin: string | null;
  gender: string | null;
  firstAppearance: { name: string | null; issueNumber: string | null } | null;
  powers: string[];
  teams: string[];
  enemyCount: number;
}

export interface CvGroup {
  id: string;
  name: string;
  image: string | null;
  members: number | null;
  hint: string | null; // start year (series) or publisher
}

export interface CvGroupMembers {
  groupName: string | null;
  characters: { id: string; name: string }[];
}

async function invoke<T>(body: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('cv-search', { body });
  if (error) throw error;
  return (data as T) ?? null;
}

export async function searchComicvineCharacters(query: string): Promise<CvCharacter[]> {
  if (query.trim().length < 2) return [];
  const d = await invoke<{ results: CvCharacter[] }>({ kind: 'character', query });
  return d?.results ?? [];
}

/** Rich detail for one ComicVine character — for the inline add-time preview. */
export async function fetchCharacterDetail(id: string): Promise<CvCharacterDetail | null> {
  if (!id) return null;
  const d = await invoke<{ detail: CvCharacterDetail | null }>({ kind: 'character_detail', id });
  return d?.detail ?? null;
}

/** ComicVine's most-appeared characters, paged — used to surface popular gaps. */
export async function fetchPopularCharacters(offset = 0): Promise<CvCharacter[]> {
  const d = await invoke<{ results: CvCharacter[] }>({ kind: 'popular', offset });
  return d?.results ?? [];
}

export async function searchComicvineGroups(resource: GroupResource, query: string): Promise<CvGroup[]> {
  if (query.trim().length < 2) return [];
  const d = await invoke<{ results: CvGroup[] }>({ kind: 'group', resource, query });
  return d?.results ?? [];
}

export async function getComicvineGroupMembers(resource: GroupResource, id: string): Promise<CvGroupMembers> {
  const d = await invoke<CvGroupMembers>({ kind: 'group_members', resource, id });
  return d ?? { groupName: null, characters: [] };
}

/** Of the given ComicVine ids, which already exist in the catalogue. */
export async function existingComicvineIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const batches = await Promise.all(
    chunk(ids, IN_CHUNK).map((slice) =>
      supabase.from('heroes').select('comicvine_id').in('comicvine_id', slice)),
  );
  const out = new Set<string>();
  for (const { data } of batches) {
    for (const r of (data as Array<{ comicvine_id: string | null }> | null) ?? []) {
      if (r.comicvine_id) out.add(r.comicvine_id);
    }
  }
  return out;
}

/** Lowercased names already in the catalogue (cross-source duplicate guard). */
export async function existingHeroNames(names: string[]): Promise<Set<string>> {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (cleaned.length === 0) return new Set();
  const batches = await Promise.all(
    chunk(cleaned, IN_CHUNK).map((slice) =>
      supabase.from('heroes').select('name').in('name', slice)),
  );
  const out = new Set<string>();
  for (const { data } of batches) {
    for (const r of (data as Array<{ name: string }> | null) ?? []) out.add(r.name.toLowerCase());
  }
  return out;
}

/** Add ComicVine characters to the catalogue (as pending). Returns count added. */
export async function addComicvineHeroes(heroes: { id: string; name: string; image: string | null }[]): Promise<number> {
  if (heroes.length === 0) return 0;
  const { data, error } = await supabase.rpc('admin_add_comicvine_heroes', { p_heroes: heroes });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Remove a hero from the catalogue by id (undo a just-added character). */
export async function deleteHero(heroId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_hero', { p_hero_id: heroId });
  if (error) throw error;
}
