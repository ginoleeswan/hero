import { supabase } from '../../supabase';

export interface SharedTitle {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  media_type: string | null;
}

export interface SharedTitles {
  /** Every title both characters appear in, including those with no poster. */
  total: number;
  first_year: number | null;
  last_year: number | null;
  /** The most recognisable few, poster-bearing, for the strip. */
  titles: SharedTitle[];
}

const EMPTY: SharedTitles = { total: 0, first_year: null, last_year: null, titles: [] };

/**
 * Films and shows two characters have both appeared in.
 *
 * The most concrete answer available to "how are these two connected" — and
 * unlike a shared roster it comes with evidence you can look at.
 */
export async function getSharedTitles(a: string, b: string, limit = 3): Promise<SharedTitles> {
  if (!a || !b || a === b) return EMPTY;
  const { data, error } = await supabase.rpc('get_shared_titles', {
    p_a: a,
    p_b: b,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getSharedTitles] error:', error.message);
    return EMPTY;
  }
  const parsed = (data ?? EMPTY) as unknown as SharedTitles;
  return { ...EMPTY, ...parsed, titles: parsed.titles ?? [] };
}

/**
 * "54 titles together, 2008–2025" — or the title itself when there's only one,
 * which is more useful than the number 1.
 */
export function sharedTitlesCaption(shared: SharedTitles): string | null {
  const { total, first_year: from, last_year: to } = shared;
  if (total <= 0) return null;
  if (total === 1) {
    const only = shared.titles[0];
    if (!only) return null;
    return only.year ? `Together in ${only.title} (${only.year}).` : `Together in ${only.title}.`;
  }
  const noun = `${total} titles together`;
  // A span only reads as a span across more than one year.
  if (from && to && to > from) return `${noun}, ${from}–${to}.`;
  return `${noun}.`;
}
