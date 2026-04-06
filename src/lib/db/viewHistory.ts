import { supabase } from '../supabase';
import type { FavouriteHero } from './favourites';

export async function recordView(userId: string, heroId: string): Promise<void> {
  await supabase
    .from('user_view_history')
    .upsert(
      { user_id: userId, hero_id: heroId, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,hero_id' },
    );
  // Intentionally swallow errors — fire-and-forget
}

export async function getRecentlyViewed(
  userId: string,
  limit = 15,
): Promise<FavouriteHero[]> {
  const { data: historyData, error: historyError } = await supabase
    .from('user_view_history')
    .select('hero_id')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);

  if (historyError) throw historyError;

  const heroIds = (historyData ?? []).map((r) => r.hero_id as string);
  if (heroIds.length === 0) return [];

  const { data: heroData, error: heroError } = await supabase
    .from('heroes')
    .select('id, name, image_url, portrait_url')
    .in('id', heroIds);

  if (heroError) throw heroError;

  const heroMap = new Map((heroData ?? []).map((h) => [h.id as string, h as FavouriteHero]));
  return heroIds.map((id) => heroMap.get(id)).filter((h): h is FavouriteHero => h !== undefined);
}
