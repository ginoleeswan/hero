import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';

export type Hero = Tables<'heroes'>;
export type HeroCategory = 'popular' | 'villain' | 'xmen';

export interface HeroesByCategory {
  popular: Hero[];
  villain: Hero[];
  xmen: Hero[];
}

export async function getHeroesByCategory(): Promise<HeroesByCategory> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .order('name');

  if (error) throw error;

  return {
    popular: data.filter((h) => h.category === 'popular'),
    villain: data.filter((h) => h.category === 'villain'),
    xmen: data.filter((h) => h.category === 'xmen'),
  };
}
