// Small pure helpers for the contribute reward copy. Kept separate so the
// celebratory messaging is easy to tune and unit-test.

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 42 → "42nd". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Warm, status-building line shown after a submission (reward is deferred, so
 *  we celebrate the act + their growing tally rather than a live change). */
export function rewardLine(contributionNumber: number): string {
  if (contributionNumber <= 1) return 'Your first contribution — welcome to the archive.';
  return `That's your ${ordinal(contributionNumber)} contribution. Keep it up!`;
}
