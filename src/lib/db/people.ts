import { supabase } from '../supabase';

export interface HeroPortrayals {
  performers: string[]; // live-action actors
  voiceActors: string[];
}

/** Who has played/voiced a hero across tracked media (from hero_people). */
export async function getHeroPortrayals(heroId: string): Promise<HeroPortrayals> {
  const { data, error } = await supabase
    .from('hero_people')
    .select('person_name, role')
    .eq('hero_id', heroId)
    .in('role', ['performer', 'voice_actor']);
  if (error || !data) return { performers: [], voiceActors: [] };

  const performers: string[] = [];
  const voiceActors: string[] = [];
  for (const r of data as { person_name: string; role: string }[]) {
    if (r.role === 'voice_actor') voiceActors.push(r.person_name);
    else performers.push(r.person_name);
  }
  return { performers, voiceActors };
}

export interface HeroLinks {
  imdb: string | null;
  site: string | null;
  wikidataQid: string | null;
  firstAppearanceYear: number | null;
}

/** External links + canonical first-appearance year for a hero (from hero_facts). */
export async function getHeroLinks(heroId: string): Promise<HeroLinks> {
  const { data, error } = await supabase
    .from('hero_facts')
    .select('key, value')
    .eq('hero_id', heroId);
  if (error || !data)
    return { imdb: null, site: null, wikidataQid: null, firstAppearanceYear: null };
  const m = new Map((data as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const yr = m.get('first_appearance_year');
  return {
    imdb: m.get('imdb_id') ?? null,
    site: m.get('official_site') ?? null,
    wikidataQid: m.get('wikidata_qid') ?? null,
    firstAppearanceYear: yr ? parseInt(yr, 10) : null,
  };
}
