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
  for (const r of data as Array<{ person_name: string; role: string }>) {
    if (r.role === 'voice_actor') voiceActors.push(r.person_name);
    else performers.push(r.person_name);
  }
  return { performers, voiceActors };
}
