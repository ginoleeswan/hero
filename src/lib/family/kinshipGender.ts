export type HeadShape = 'feminine' | 'masculine' | 'neutral';

// Only explicit kinship nouns. "maternal"/"paternal" are deliberately absent:
// a "maternal grandfather" is a man on the mother's side, so treating those
// words as a gender signal would be wrong roughly half the time.
const FEMININE = [
  'mother',
  'grandmother',
  'daughter',
  'granddaughter',
  'sister',
  'aunt',
  'wife',
  'widow',
  'niece',
];
const MASCULINE = [
  'father',
  'grandfather',
  'son',
  'grandson',
  'brother',
  'uncle',
  'husband',
  'widower',
  'nephew',
];

const wordish = (words: string[]) => new RegExp(`(^|[^a-z])(${words.join('|')})([^a-z]|$)`);
const FEM_RE = wordish(FEMININE);
const MASC_RE = wordish(MASCULINE);

/**
 * Which placeholder silhouette a family-tree entry should use.
 *
 * Roughly 80% of family-tree rows are names that were never matched to a hero,
 * so they can never have a real avatar. Rather than leave those slots empty, we
 * show a featureless silhouette — and the ROLE TEXT tells us which one, because
 * the source data literally says "mother" or "father".
 *
 * That distinction matters: this reads a stated fact, it never infers anything
 * from a person's name. Where the role doesn't say (cousin, ancestor, "other",
 * or nothing at all) the answer is 'neutral', not a guess.
 *
 * Word boundaries are enforced so "grandmother" isn't read as "mother" and,
 * more importantly, so "maternal grandfather" comes back masculine rather than
 * being caught by the "maternal" prefix.
 */
export function headShapeForRole(role?: string | null): HeadShape {
  const r = (role ?? '').toLowerCase();
  if (!r) return 'neutral';
  const fem = FEM_RE.test(r);
  const masc = MASC_RE.test(r);
  // Contradictory text ("mother's brother") states no single subject — stay out of it.
  if (fem === masc) return 'neutral';
  return fem ? 'feminine' : 'masculine';
}
