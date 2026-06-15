import { supabase } from '../supabase';

// "Always feel current" rails — characters tied to the real-world film/TV slate,
// served by the get_trending_heroes RPC over the TMDB-backed titles table and the
// hero_media_appearances graph. Read-only; the RPC does the join, dedup and
// ordering so the client just renders cards.

export type TrendingBucket = 'on_screen' | 'coming_soon' | 'streaming';

export interface TrendingHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** The title that put this character on the rail (e.g. "Superman"). */
  context_title: string | null;
  media_type: string | null;
  release_date: string | null;
  /** US streaming service for the `streaming` bucket (e.g. "Disney Plus"). */
  provider: string | null;
}

export async function getTrendingHeroes(
  bucket: TrendingBucket,
  limit = 20,
): Promise<TrendingHero[]> {
  const { data, error } = await supabase.rpc('get_trending_heroes', {
    p_bucket: bucket,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getTrendingHeroes] error:', error.message);
    return [];
  }
  return (data ?? []) as TrendingHero[];
}
