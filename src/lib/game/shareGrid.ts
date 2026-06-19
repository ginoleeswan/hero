// Builds the spoiler-free emoji grid players share after the daily game —
// one row per guess, a coloured square per clue category. Pure + tested.
import type { GuessClue, Match } from './guessCompare';

const CELL: Record<Match, string> = { hit: '🟩', close: '🟨', miss: '⬛' };

/** Categories, in the order they appear in the on-screen clue row + share grid. */
function cellsFor(g: GuessClue): Match[] {
  return [
    g.publisher.match,
    g.alignment.match,
    g.origin.match,
    g.gender.match,
    g.firstYear.match,
    g.powerTotal.match,
    g.powers.match,
  ];
}

export function buildShareGrid(opts: {
  number: number;
  guesses: GuessClue[];
  solved: boolean;
  maxGuesses: number;
}): string {
  const { number, guesses, solved, maxGuesses } = opts;
  const score = solved ? `${guesses.length}/${maxGuesses}` : `X/${maxGuesses}`;
  const header = `Guess the Hero #${number}  ${score}`;
  const rows = guesses.map((g) =>
    cellsFor(g)
      .map((m) => CELL[m])
      .join(''),
  );
  return [header, '', ...rows].join('\n');
}
