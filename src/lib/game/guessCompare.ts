// Pure comparison logic for the daily "Guess the Hero" game (Wordle-style).
// Given a guessed hero and the day's target, produce a per-attribute clue grid.
// Kept pure + framework-free so it's unit-tested and shared by native + web.

export interface GuessHero {
  id: string;
  name: string;
  imageUrl: string | null;
  portraitUrl: string | null;
  publisher: string | null;
  alignment: string | null; // 'good' | 'bad' | 'neutral'
  origin: string | null; // mutant | alien | human | …
  gender: string | null;
  firstYear: number | null; // parsed from first_appearance
  powerTotal: number | null; // powerstats_total
  powers: string[];
}

export type Match = 'hit' | 'close' | 'miss';
export type Direction = 'up' | 'down' | 'equal';

export interface CategoryClue {
  value: string | null;
  match: Match;
}
export interface NumericClue {
  value: number | null;
  match: Match;
  /** Which way the guess must move to reach the target ('up' = target is higher). */
  direction: Direction | null;
}
export interface PowersClue {
  /** The guess's own powers (for display). */
  value: string[];
  shared: number;
  match: Match;
}

export interface GuessClue {
  id: string;
  name: string;
  imageUrl: string | null;
  portraitUrl: string | null;
  correct: boolean;
  publisher: CategoryClue;
  alignment: CategoryClue;
  origin: CategoryClue;
  gender: CategoryClue;
  firstYear: NumericClue;
  powerTotal: NumericClue;
  powers: PowersClue;
}

const BLANK = new Set(['', '-', 'null', 'none', 'unknown']);

function norm(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t === '' || BLANK.has(t.toLowerCase())) return null;
  return t;
}

/** Pull a four-digit year (1900–2099) out of a first-appearance string. */
export function parseFirstYear(firstAppearance: string | null | undefined): number | null {
  if (!firstAppearance) return null;
  const m = firstAppearance.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
}

function categoryMatch(a: string | null, b: string | null): Match {
  const x = norm(a);
  const y = norm(b);
  if (x === null || y === null) return 'miss';
  return x.toLowerCase() === y.toLowerCase() ? 'hit' : 'miss';
}

function numericClue(
  guess: number | null,
  target: number | null,
  hitWithin: number,
  closeWithin: number,
): NumericClue {
  if (guess === null || target === null) {
    return { value: guess, match: 'miss', direction: null };
  }
  const diff = target - guess;
  const abs = Math.abs(diff);
  const match: Match = abs <= hitWithin ? 'hit' : abs <= closeWithin ? 'close' : 'miss';
  const direction: Direction = diff === 0 ? 'equal' : diff > 0 ? 'up' : 'down';
  return { value: guess, match, direction };
}

/** Compare a guessed hero to the day's target, producing the clue row. */
export function compareGuess(guess: GuessHero, target: GuessHero): GuessClue {
  const guessPowers = guess.powers.map((p) => p.trim()).filter(Boolean);
  const targetSet = new Set(target.powers.map((p) => p.trim().toLowerCase()).filter(Boolean));
  const shared = guessPowers.filter((p) => targetSet.has(p.toLowerCase())).length;
  const powersMatch: Match =
    targetSet.size > 0 && shared === targetSet.size && shared === guessPowers.length
      ? 'hit'
      : shared > 0
        ? 'close'
        : 'miss';

  return {
    id: guess.id,
    name: guess.name,
    imageUrl: guess.imageUrl,
    portraitUrl: guess.portraitUrl,
    correct: guess.id === target.id,
    publisher: { value: guess.publisher, match: categoryMatch(guess.publisher, target.publisher) },
    alignment: { value: guess.alignment, match: categoryMatch(guess.alignment, target.alignment) },
    origin: { value: guess.origin, match: categoryMatch(guess.origin, target.origin) },
    gender: { value: guess.gender, match: categoryMatch(guess.gender, target.gender) },
    // First appearance: exact year is a hit, within a decade is close.
    firstYear: numericClue(guess.firstYear, target.firstYear, 0, 10),
    // Power total (0–600 scale): within 10 is a hit, within 50 is close.
    powerTotal: numericClue(guess.powerTotal, target.powerTotal, 10, 50),
    powers: { value: guessPowers, shared, match: powersMatch },
  };
}
