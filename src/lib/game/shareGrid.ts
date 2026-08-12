// Builds the spoiler-free result players share after the daily game — a single
// row of squares (one per guess used), the header + score, and the link.
//
// The link is the whole point of the format. Wordle's growth loop is not the
// emoji grid, it is the third line: a grid with no URL is a score nobody can
// act on, and this one did not even name the app it came from. Pure + tested.
import { shareLink } from '../share';

export function buildShareGrid(opts: {
  number: number;
  attempts: number; // guesses made
  solved: boolean;
  maxGuesses: number;
}): string {
  const { number, attempts, solved, maxGuesses } = opts;
  const score = solved ? `${attempts}/${maxGuesses}` : `X/${maxGuesses}`;
  const header = `Mythique · Guess the Hero #${number}  ${score}`;
  const row = solved ? '🟥'.repeat(Math.max(attempts - 1, 0)) + '🟩' : '🟥'.repeat(maxGuesses);
  return `${header}\n${row}\n${shareLink.daily()}`;
}
