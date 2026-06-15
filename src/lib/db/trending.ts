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

// ── Title-grouped clusters (Phase 2) ─────────────────────────────────────────
// Same buckets as above, but grouped by title so Explore can render a poster +
// its cast — making the show↔character link explicit. Ranked by TMDB popularity
// when present, recency otherwise (see get_trending_titles).

export interface TrendingTitleCharacter {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
}

export interface TrendingTitle {
  id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  provider: string | null;
  characters: TrendingTitleCharacter[];
}

export async function getTrendingTitles(
  bucket: TrendingBucket,
  titleLimit = 6,
  charsPerTitle = 12,
): Promise<TrendingTitle[]> {
  const { data, error } = await supabase.rpc('get_trending_titles', {
    p_bucket: bucket,
    p_title_limit: titleLimit,
    p_chars_per_title: charsPerTitle,
  });
  if (error) {
    console.warn('[getTrendingTitles] error:', error.message);
    return [];
  }
  // Flat rows (title fields repeated per character) → grouped titles, preserving
  // the RPC's order (titles by rank, characters by fame within each title).
  const byTitle = new Map<string, TrendingTitle>();
  for (const r of (data ?? []) as {
    title_id: string;
    title: string;
    media_type: string | null;
    release_date: string | null;
    backdrop_url: string | null;
    poster_url: string | null;
    provider: string | null;
    hero_id: string;
    hero_name: string;
    hero_image_url: string | null;
    hero_portrait_url: string | null;
  }[]) {
    let t = byTitle.get(r.title_id);
    if (!t) {
      t = {
        id: r.title_id,
        title: r.title,
        media_type: r.media_type,
        release_date: r.release_date,
        backdrop_url: r.backdrop_url,
        poster_url: r.poster_url,
        provider: r.provider,
        characters: [],
      };
      byTitle.set(r.title_id, t);
    }
    t.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
    });
  }
  return [...byTitle.values()];
}

/** A short meta line for a trending title — provider, upcoming date, or year. */
export function trendingTitleMeta(t: TrendingTitle): string | null {
  if (t.provider) return `On ${t.provider}`;
  if (t.release_date) {
    const d = new Date(t.release_date);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() > Date.now()) {
      return `Coming ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return String(d.getFullYear());
  }
  return null;
}
