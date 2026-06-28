// Calendar-driven "This Month in History" reader. No external API — the data is
// already in heroes.first_issue_data; the month rollover is the only refresh.
import { supabase } from '../supabase';

export interface DebutHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** The debut issue's cover art. */
  debut_cover_url: string | null;
  /** Year the character first appeared (e.g. 1938). */
  year: number;
  /** Years since the debut, against the current calendar year (e.g. 88). */
  yearsAgo: number;
}

interface DebutRow {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  debut_cover_url: string | null;
  debut_year: number | null;
  fame_score: number | null;
}

/** Recognizable characters who debuted in the current calendar month, fame-ranked.
 *  Degrades to [] so a DB hiccup never errors the Explore band. */
export async function getDebutsThisMonth(limit = 14): Promise<DebutHero[]> {
  const { data, error } = await supabase.rpc('get_debuts_this_month', { p_limit: limit } as never);
  if (error) {
    console.warn('[getDebutsThisMonth] error:', error.message);
    return [];
  }
  const currentYear = new Date().getFullYear();
  return ((data ?? []) as unknown as DebutRow[]).map((r) => {
    const year = r.debut_year ?? currentYear;
    return {
      id: r.id,
      name: r.name,
      image_url: r.image_url,
      portrait_url: r.portrait_url,
      debut_cover_url: r.debut_cover_url,
      year,
      yearsAgo: Math.max(0, currentYear - year),
    };
  });
}
