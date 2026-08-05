// src/lib/characterFacts.ts — one answer to "is this field worth showing?".
//
// Catalog rows carry placeholder text rather than NULL for missing data: the
// SuperheroAPI-era import wrote literal '-', 'null', 'None', 'N/A', 'Unknown'
// and 'No alter egos found.' into columns it couldn't fill, and the ComicVine
// pipeline never cleaned them up.
//
// Both halves of the character screen filtered these, and had drifted: the web
// half checked a six-value set, the native half checked only '-' and 'null'.
// The result was that 426 characters showed a literal "No alter egos found."
// on a phone and nothing on a laptop, plus 236 "Unknown" birthplaces and 164
// "Unknown" occupations. Nothing flagged it, because the two files simply never
// get read side by side.
//
// This module is the single answer, so the next divergence has to be
// deliberate. Presentation-only — it never rewrites the database.

/**
 * Placeholder strings that mean "we don't know", compared lowercased and
 * trimmed. Add to this rather than to a local copy in a view.
 */
export const JUNK_FACT_VALUES = new Set([
  '-',
  'null',
  'none',
  'n/a',
  'unknown',
  'no alter egos found.',
]);

/** True when a field carries real information worth rendering. */
export function isPresentableFact(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (v === '') return false;
  if (JUNK_FACT_VALUES.has(v.toLowerCase())) return false;
  // Punctuation-only leftovers: a lone dash, a slash pair from a joined
  // "height / height" where both sides were empty, an en dash.
  if (/^[\s/–-]*$/.test(v)) return false;
  return true;
}

/** The trimmed value, or null when there is nothing worth showing. */
export function cleanFact(value: string | null | undefined): string | null {
  return isPresentableFact(value) ? (value as string).trim() : null;
}
