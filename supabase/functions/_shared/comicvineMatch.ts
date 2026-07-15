// supabase/functions/_shared/comicvineMatch.ts
// Shared ComicVine name-match decision, imported by BOTH enrich-comicvine-batch
// (the cron drain) and get-comicvine-hero (the live per-view fallback) so the
// logic can't drift between the two.
//
// Pure (no fetch / Deno / https imports) so Jest can unit-test it — same posture
// as _shared/igdb-transform.ts.
//
// THE BUG THIS FIXES (issue #65): matching on exact name only and taking the
// most-published hit silently resolves same-name characters from unrelated
// franchises — hand-curated "Aragorn" (publisher "J. R. R. Tolkien") matched a
// Marvel winged horse and overwrote the row. The gate below requires the
// candidate's publisher to plausibly agree with the hero's before auto-applying;
// anything ambiguous is routed to human review instead of blindly enriched.

/** One ComicVine /characters search result (the fields we request). */
export interface CvCandidate {
  id?: number | string;
  name?: unknown;
  count_of_issue_appearances?: number;
  // ComicVine returns publisher as an object with a `name`. Requesting it in the
  // search field_list is what makes the gate possible pre-commit.
  publisher?: { name?: string } | null;
}

export type MatchDecision =
  | { kind: 'match'; cvId: string }
  | { kind: 'needs_review'; reason: string }
  | { kind: 'unmatched' };

// Publisher values that mean "not really a comic publisher" — treat as absent.
// Stored in post-punctuation-strip form (see normalizePublisher).
const UNBRANDED = new Set(['companylicensed', 'creatorowned']);

/**
 * Normalize a publisher string for comparison: lowercase, strip punctuation, and
 * collapse the common house aliases (Marvel / DC / Dark Horse / Image) to a
 * canonical token so "Marvel" and "Marvel Comics" agree.
 */
export function normalizePublisher(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || UNBRANDED.has(s)) return null;
  if (s.startsWith('marvel')) s = 'marvel';
  else if (s === 'dc' || s.startsWith('dc ')) s = 'dc';
  else if (s.startsWith('dark horse')) s = 'dark horse';
  else if (s.startsWith('image')) s = 'image';
  return s;
}

/** Do two normalized publishers plausibly denote the same publisher? */
function publishersAgree(a: string, b: string): boolean {
  return a === b || a.includes(b) || b.includes(a);
}

const candidateName = (c: CvCandidate): string =>
  typeof c.name === 'string' ? c.name.trim().toLowerCase() : '';
// ComicVine often disambiguates with a parenthetical ("Spawn (Simmons)").
const baseName = (c: CvCandidate): string => candidateName(c).split('(')[0].trim();
const byPop = (a: CvCandidate, b: CvCandidate): number =>
  (b.count_of_issue_appearances ?? 0) - (a.count_of_issue_appearances ?? 0);

/**
 * Decide which ComicVine candidate (if any) a hero resolves to.
 *
 * 1. Filter to an EXACT name match (case-insensitive), else name-before-"(".
 *    None → `unmatched` (terminal, not an error — same as before).
 * 2. Publisher gate:
 *    - Hero HAS a publisher: keep only candidates whose publisher agrees; if
 *      some agree → `match` (most-published of those). If NONE agree →
 *      `needs_review` (the Aragorn case — never auto-apply a disagreeing match).
 *    - Hero has NO usable publisher: one candidate → `match`; multiple with
 *      differing publishers → `needs_review` (ambiguous same-name); multiple
 *      that all share a publisher → `match` (most-published).
 */
export function pickComicvineMatch(
  results: CvCandidate[],
  hero: { name: string; publisher: string | null },
): MatchDecision {
  const wanted = hero.name.trim().toLowerCase();
  const named = (results ?? []).filter((c) => candidateName(c) !== '');
  const exact = named.filter((c) => candidateName(c) === wanted);
  const matches = exact.length > 0 ? exact : named.filter((c) => baseName(c) === wanted);
  if (matches.length === 0) return { kind: 'unmatched' };

  const heroPub = normalizePublisher(hero.publisher);
  const withId = (c: CvCandidate): MatchDecision =>
    c.id != null ? { kind: 'match', cvId: String(c.id) } : { kind: 'unmatched' };

  if (heroPub) {
    const agreeing = matches.filter((c) => {
      const p = normalizePublisher(c.publisher?.name);
      return p != null && publishersAgree(heroPub, p);
    });
    if (agreeing.length > 0) return withId([...agreeing].sort(byPop)[0]);
    const topPub = normalizePublisher([...matches].sort(byPop)[0]?.publisher?.name) ?? 'unknown';
    return { kind: 'needs_review', reason: `publisher mismatch: hero=${heroPub} cv=${topPub}` };
  }

  // Hero has no usable publisher — disambiguate only by same-name multiplicity.
  if (matches.length === 1) return withId(matches[0]);
  const distinctPubs = new Set(
    matches.map((c) => normalizePublisher(c.publisher?.name)).filter((p): p is string => p != null),
  );
  if (distinctPubs.size > 1) {
    return { kind: 'needs_review', reason: `ambiguous: ${matches.length} same-name candidates` };
  }
  return withId([...matches].sort(byPop)[0]);
}
