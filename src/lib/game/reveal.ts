// Pure logic for the daily "Guess the Hero" game (image-reveal format). The
// answer's portrait starts heavily blurred and sharpens with every wrong guess;
// one short text clue is uncovered per miss. All deterministic + unit-tested;
// the hook and view just render what these return.

export interface RevealHero {
  id: string;
  name: string;
  fullName: string | null;
  aliases: string[];
  summary: string | null;
  imageUrl: string | null;
  portraitUrl: string | null;
  publisher: string | null;
  alignment: string | null;
  origin: string | null;
  gender: string | null;
  firstAppearance: string | null;
  powers: string[];
}

import { alignmentLabel as taxoAlignment } from '../characterTaxonomy';

export interface Clue {
  label: string;
  value: string;
}

const SENTINELS = new Set(['', '-', '–', 'null', 'none', 'n/a', 'unknown', 'undefined']);

/** True for values that are effectively blank (missing data dressed up as text). */
export function isBlank(v: string | null | undefined): boolean {
  return v == null || SENTINELS.has(v.trim().toLowerCase());
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pull a 4-digit year out of a free-form first-appearance string. */
export function parseFirstYear(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

/** "1962" / "Action Comics (1938)" -> "1930s". null when no year is present. */
export function decadeOf(firstAppearance: string | null | undefined): string | null {
  const year = parseFirstYear(firstAppearance);
  if (year == null) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

/**
 * Player-facing alignment label. Words come from src/lib/characterTaxonomy.ts —
 * this file used to spell it "Anti-hero" while every other surface wrote
 * "Anti-Hero", so the same character was described two ways between the daily
 * puzzle and its own character page.
 */
export function alignmentLabel(a: string | null | undefined): string | null {
  if (isBlank(a)) return null;
  const v = (a as string).trim().toLowerCase();
  // 'evil' is a legacy synonym that only shows up in this dataset.
  const shared = taxoAlignment(v === 'evil' ? 'bad' : v);
  if (shared) return shared;
  // Anything unrecognised still gets shown, capitalised — a clue is better than
  // a blank.
  return cap(v);
}

// How blurred the portrait is after N wrong guesses. It starts moderate — the
// silhouette and colours read, but not the identity — so the very first guess
// is informed, then sharpens to almost-clear. Fully clear once the puzzle is
// over (the hook passes finished=true).
const BLUR_LADDER = [24, 16, 10, 5, 2];

export function blurForGuess(guessesMade: number, finished: boolean): number {
  if (finished) return 0;
  const i = Math.min(Math.max(guessesMade, 0), BLUR_LADDER.length - 1);
  return BLUR_LADDER[i];
}

/**
 * The ordered ladder of text clues, blanks dropped. Easiest-to-hardest so early
 * clues still help.
 */
export function buildClues(hero: RevealHero): Clue[] {
  const out: Clue[] = [];
  if (!isBlank(hero.publisher)) out.push({ label: 'Publisher', value: hero.publisher as string });
  const decade = decadeOf(hero.firstAppearance);
  if (decade) out.push({ label: 'First appeared', value: decade });
  const align = alignmentLabel(hero.alignment);
  if (align) out.push({ label: 'Alignment', value: align });
  if (!isBlank(hero.origin))
    out.push({ label: 'Origin', value: cap((hero.origin as string).trim()) });
  const power = hero.powers.find((p) => !isBlank(p));
  if (power) out.push({ label: 'Signature power', value: power });
  return out;
}

/**
 * Clues unlocked so far. One is free at the start (so the first guess isn't
 * blind), then a fresh one per wrong guess; all of them once finished.
 */
export function visibleClues(clues: Clue[], guessesMade: number, finished: boolean): Clue[] {
  if (finished) return clues;
  return clues.slice(0, Math.min(guessesMade + 1, clues.length));
}
