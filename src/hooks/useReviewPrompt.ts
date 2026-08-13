// src/hooks/useReviewPrompt.ts — the screens' side of the rating ask.
//
// A screen says "the reader just finished something good"; this decides whether
// that earns the ask, raises it, and records it. Every rule is in
// lib/review/policy.ts.
import { useCallback, useRef } from 'react';
import { arenaFinishedCount, maybeRequestReview, noteArenaFinished } from '../lib/review';
import { track } from '../lib/analytics';

export function useReviewPrompt() {
  // One ask per mount whatever the caller does — the daily screen re-renders on
  // every guess and an effect-driven ask would fire repeatedly.
  const spent = useRef(false);

  /** The reader is on a real streak. Nothing else about the daily earns it. */
  const considerAfterStreak = useCallback(async (streak: number, blocked: boolean) => {
    if (spent.current) return;
    spent.current = true;
    const asked = await maybeRequestReview({
      trigger: 'daily_streak',
      streak,
      arenaFinished: 0,
      blocked,
    });
    if (asked) track('review_prompt_requested', { trigger: 'daily_streak' });
  }, []);

  /** A battle just resolved. The count is per-device and needs no account. */
  const considerAfterArena = useCallback(async () => {
    if (spent.current) return;
    spent.current = true;
    await noteArenaFinished();
    const asked = await maybeRequestReview({
      trigger: 'arena_finished',
      streak: 0,
      arenaFinished: await arenaFinishedCount(),
      blocked: false,
    });
    if (asked) track('review_prompt_requested', { trigger: 'arena_finished' });
  }, []);

  return { considerAfterStreak, considerAfterArena };
}
