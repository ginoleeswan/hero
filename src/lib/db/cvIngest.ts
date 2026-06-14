import { supabase } from '../supabase';

export type GroupResource = 'team' | 'volume';

export interface CvCharacter {
  id: string;
  name: string;
  publisher: string | null;
  image: string | null;
  deck: string | null;
}

export interface CvGroup {
  id: string;
  name: string;
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
  const { data, error } = await supabase.from('heroes').select('comicvine_id').in('comicvine_id', ids);
  if (error || !data) return new Set();
  return new Set((data as Array<{ comicvine_id: string | null }>).map((r) => r.comicvine_id).filter((x): x is string => !!x));
}

/** Lowercased names already in the catalogue (cross-source duplicate guard). */
export async function existingHeroNames(names: string[]): Promise<Set<string>> {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (cleaned.length === 0) return new Set();
  const { data, error } = await supabase.from('heroes').select('name').in('name', cleaned);
  if (error || !data) return new Set();
  return new Set((data as Array<{ name: string }>).map((r) => r.name.toLowerCase()));
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
