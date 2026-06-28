import { supabase } from '../supabase';
import type { HeroImage } from '../../types';

/** All gallery images for a hero, ordered (primary image first, then covers). */
export async function getHeroImages(heroId: string): Promise<HeroImage[]> {
  const { data, error } = await supabase
    .from('hero_images')
    .select('url, caption, source, issue_id')
    .eq('hero_id', heroId)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[getHeroImages] error:', error.message);
    return [];
  }
  return data.map((r) => ({
    url: r.url,
    caption: r.caption,
    source: r.source,
    issueId: r.issue_id,
  }));
}
