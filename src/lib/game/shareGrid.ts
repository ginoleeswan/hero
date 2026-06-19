// Builds the spoiler-free result players share after the daily game — a single
// row of squares (one per guess used) plus the header + score. Pure + tested.

export function buildShareGrid(opts: {
  number: number;
  attempts: number; // guesses made
  solved: boolean;
  maxGuesses: number;
}): string {
  const { number, attempts, solved, maxGuesses } = opts;
  const score = solved ? `${attempts}/${maxGuesses}` : `X/${maxGuesses}`;
  const header = `Guess the Hero #${number}  ${score}`;
  const row = solved ? '🟥'.repeat(Math.max(attempts - 1, 0)) + '🟩' : '🟥'.repeat(maxGuesses);
  return `${header}\n${row}`;
}
