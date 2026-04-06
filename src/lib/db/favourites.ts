import { supabase } from '../supabase';
import type { FavouriteHero } from '../../types';

export type { FavouriteHero };

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

export async function getUserFavouriteHeroes(userId: string): Promise<FavouriteHero[]> {
  const { data: favData, error: favError } = await supabase
    .from('user_favourites')
    .select('hero_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (favError) throw favError;

  const heroIds = (favData ?? []).map((r) => r.hero_id).filter((id): id is string => id !== null);
  if (heroIds.length === 0) return [];

  const { data: heroData, error: heroError } = await supabase
    .from('heroes')
    .select('id, name, image_url, portrait_url')
    .in('id', heroIds);
  if (heroError) throw heroError;

  // Preserve favourited order
  const heroMap = new Map((heroData ?? []).map((h) => [h.id, h]));
  return heroIds.map((id) => heroMap.get(id)).filter((h): h is FavouriteHero => h !== undefined);
}

export async function getFavouriteCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_favourites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}
