// src/lib/characterTaxonomy.ts — the words the app uses for a character's
// alignment and origin.
//
// Labels only, deliberately: the chip colours differ between the native and web
// character pages because each resolves against a different surface, and forcing
// those together would change how both look. What must not differ is the *word*,
// and it did — the two halves of the character screen each carried their own
// map, and they had drifted:
//
//   alignment 'neutral' → "Neutral" on a phone, "Anti-Hero" on a laptop (919
//                         characters, a fifth of everything with an alignment)
//   origin 'training'   → "Training" on a phone, "Trained" on a laptop
//
// Nothing caught it because the two files are 2,300 and 4,300 lines and are
// never read together.

/**
 * Alignment chip wording.
 *
 * 'neutral' resolves to "Neutral" rather than web's old "Anti-Hero": the
 * alignment field covers genuinely unaligned characters — cosmic entities,
 * forces of nature — for whom "Anti-Hero" is a claim the data doesn't support.
 * If the product voice wants the punchier word, this is the one line to change,
 * and it now changes both platforms at once.
 */
export const ALIGNMENT_LABELS: Record<string, string> = {
  good: 'Hero',
  bad: 'Villain',
  neutral: 'Neutral',
};

/** Origin chip wording. */
export const ORIGIN_LABELS: Record<string, string> = {
  mutant: 'Mutant',
  alien: 'Alien',
  human: 'Human',
  'god/eternal': 'Eternal',
  radiation: 'Radiation',
  cyborg: 'Cyborg',
  robot: 'Robot',
  inhuman: 'Inhuman',
  // "Trained", not native's old "Training" — the chip describes what the
  // character is, not the process.
  training: 'Trained',
};

const lookup = (map: Record<string, string>, raw: string | null | undefined) =>
  raw ? (map[raw.toLowerCase().trim()] ?? null) : null;

export const alignmentLabel = (value: string | null | undefined) => lookup(ALIGNMENT_LABELS, value);

export const originLabel = (value: string | null | undefined) => lookup(ORIGIN_LABELS, value);
