import { supabase } from '../supabase';

export async function isFavourited(userId: string, heroId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_favourites')
    .select('id')
    .eq('user_id', userId)
    .eq('hero_id', heroId)
    .maybeSingle();
  return !!data;
}

export async function addFavourite(userId: string, heroId: string): Promise<void> {
  const { error } = await supabase
    .from('user_favourites')
    .insert({ user_id: userId, hero_id: heroId });
  if (error) throw error;
}

export async function removeFavourite(userId: string, heroId: string): Promise<void> {
  const { error } = await supabase
    .from('user_favourites')
    .delete()
    .eq('user_id', userId)
    .eq('hero_id', heroId);
  if (error) throw error;
}

export async function getFavouriteCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_favourites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}
