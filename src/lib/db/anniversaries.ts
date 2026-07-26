// Calendar-driven "This Month in History" reader. No external API — the data is
// already in heroes.first_issue_data; the month rollover is the only refresh.
// Issue-centric: one entry per debut ISSUE (deduped), carrying the fame-ranked
// cast of characters who first appeared in it.
import { supabase } from '../supabase';

export interface DebutCharacter {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** Flat head icon — famous tier only, so every consumer must degrade. */
  avatar_url: string | null;
}

export interface DebutIssue {
  issueId: string;
  seriesName: string;
  issueNumber: string | null;
  /** The issue's cover art. */
  cover_url: string | null;
  /** Year the issue was published (e.g. 1938). */
  year: number;
  /** Years since publication, against the current calendar year (e.g. 88). */
  yearsAgo: number;
  /** Characters who first appeared in this issue, fame-ranked. */
  characters: DebutCharacter[];
}

export interface DebutIssueRow {
  issue_id: string;
  series_name: string | null;
  issue_number: string | null;
  cover_url: string | null;
  debut_year: number | null;
  characters: DebutCharacter[] | null;
}

/** Flat RPC rows → DebutIssue. Shared with the explore-bundle path. */
export function mapDebutRows(rows: DebutIssueRow[]): DebutIssue[] {
  const currentYear = new Date().getFullYear();
  return rows.map((r) => {
    const year = r.debut_year ?? currentYear;
    return {
      issueId: r.issue_id,
      seriesName: r.series_name ?? '',
      issueNumber: r.issue_number,
      cover_url: r.cover_url,
      year,
      yearsAgo: Math.max(0, currentYear - year),
      characters: r.characters ?? [],
    };
  });
}

/** Recognizable debut issues from the current calendar month, ranked by their top
 *  character's fame, each with its debutant cast. Degrades to [] so a DB hiccup
 *  never errors the Explore band. */
export async function getDebutsThisMonth(limit = 12): Promise<DebutIssue[]> {
  const { data, error } = await supabase.rpc('get_debuts_this_month', { p_limit: limit } as never);
  if (error) {
    console.warn('[getDebutsThisMonth] error:', error.message);
    return [];
  }
  return mapDebutRows((data ?? []) as unknown as DebutIssueRow[]);
}
