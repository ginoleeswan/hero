import { supabase } from '../supabase';

export interface CvCharacter {
  id: string;
  name: string;
  publisher: string | null;
  image: string | null;
  deck: string | null;
}

export interface CvTeam {
  id: string;
  name: string;
  members: number | null;
}

export interface CvTeamMembers {
  teamName: string | null;
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

export async function searchComicvineTeams(query: string): Promise<CvTeam[]> {
  if (query.trim().length < 2) return [];
  const d = await invoke<{ results: CvTeam[] }>({ kind: 'team', query });
  return d?.results ?? [];
}

export async function getComicvineTeamMembers(teamId: string): Promise<CvTeamMembers> {
  const d = await invoke<CvTeamMembers>({ kind: 'team_members', teamId });
  return d ?? { teamName: null, characters: [] };
}

/** Of the given ComicVine ids, which already exist in the catalogue. */
export async function existingComicvineIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from('heroes')
    .select('comicvine_id')
    .in('comicvine_id', ids);
  if (error || !data) return new Set();
  return new Set((data as Array<{ comicvine_id: string | null }>).map((r) => r.comicvine_id).filter((x): x is string => !!x));
}

/** Add ComicVine characters to the catalogue (as pending). Returns count added. */
export async function addComicvineHeroes(heroes: { id: string; name: string; image: string | null }[]): Promise<number> {
  if (heroes.length === 0) return 0;
  const { data, error } = await supabase.rpc('admin_add_comicvine_heroes', { p_heroes: heroes });
  if (error) throw error;
  return (data as number) ?? 0;
}
