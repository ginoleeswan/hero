import { supabase } from '../supabase';
import type { FavouriteHero } from '../../types';

// "Picked For You" — the discovery row (see migration 20260716100000). The
// get_my_for_you RPC blends graph neighbors of your recent favourites with
// taste-affinity (franchise/publisher) picks, EXCLUDING everything you've
// already favourited or viewed. Identity is auth.uid() server-side; logged out
// (or signal-less) it returns [] and the row hides.
export async function getForYou(limit = 20): Promise<FavouriteHero[]> {
  const { data, error } = await supabase.rpc('get_my_for_you', { p_limit: limit });
  if (error) {
    console.warn('[getForYou] error:', error.message);
    return [];
  }
  return (data ?? []) as FavouriteHero[];
}
