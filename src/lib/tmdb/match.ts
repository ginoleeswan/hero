// Pure TMDB title-matching logic. No Deno/React deps so it is jest-testable.
// NOTE: the enrich-tmdb-batch edge function carries a parallel copy of this
// scoring (edge functions deploy self-contained, no cross-imports) — keep them
// in sync; this file is the tested source of truth.

export interface TmdbSearchResult {
  id: number;
  title: string;
  release_date: string | null;
}

const ARTICLES = /^(the|a|an)\s+/;

/** Lowercase, drop a leading article, strip punctuation, collapse whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/-/g, '')
    .replace(ARTICLES, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Token Jaccard similarity in [0,1] between two normalized titles. */
function similarity(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

const THRESHOLD = 0.6;

/**
 * Pick the best TMDB candidate for a CV title, or null if none is confident.
 * Score = title similarity, with a small bonus when the release year matches the
 * CV year hint (breaks ties between same-named films).
 */
export function pickBestMatch(
  cvTitle: string,
  candidates: TmdbSearchResult[],
  yearHint: string | null,
): TmdbSearchResult | null {
  const q = normalizeTitle(cvTitle);
  let best: TmdbSearchResult | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    let score = similarity(q, normalizeTitle(c.title));
    if (yearHint && c.release_date?.startsWith(yearHint)) score += 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= THRESHOLD ? best : null;
}
