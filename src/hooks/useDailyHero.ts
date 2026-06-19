// Platform-neutral state for the daily "Guess the Hero" game (shared by the
// native + web screens). Loads the puzzle, restores saved progress + streak
// from local storage, resolves each guess against today's answer, and tracks
// win/lose + streak. Logged-in or not — everything is local (Wordle-style).
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyHero, heroToGuessHero, type DailyPuzzle } from '../lib/db/dailyHero';
import { getHeroById } from '../lib/db/heroes';
import { compareGuess, type GuessClue } from '../lib/game/guessCompare';
import { buildShareGrid } from '../lib/game/shareGrid';
import { applyResult, EMPTY_STREAK, type StreakState } from '../lib/game/streak';

export const MAX_GUESSES = 6;
export type GameStatus = 'loading' | 'error' | 'playing' | 'won' | 'lost';

const dayKey = (date: string) => `dh_v1_${date}`;
const STREAK_KEY = 'dh_streak_v1';

interface SavedDay {
  guesses: GuessClue[];
  status: 'playing' | 'won' | 'lost';
}

export function useDailyHero() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [status, setStatus] = useState<GameStatus>('loading');
  const [guesses, setGuesses] = useState<GuessClue[]>([]);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const p = await getDailyHero();
      if (!active) return;
      if (!p) {
        setStatus('error');
        return;
      }
      setPuzzle(p);
      const [savedRaw, streakRaw] = await Promise.all([
        AsyncStorage.getItem(dayKey(p.date)).catch(() => null),
        AsyncStorage.getItem(STREAK_KEY).catch(() => null),
      ]);
      if (!active) return;
      if (streakRaw) {
        try {
          setStreak(JSON.parse(streakRaw) as StreakState);
        } catch {
          /* ignore corrupt streak */
        }
      }
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw) as SavedDay;
          setGuesses(saved.guesses);
          setStatus(saved.status);
          return;
        } catch {
          /* ignore corrupt save */
        }
      }
      setStatus('playing');
    })();
    return () => {
      active = false;
    };
  }, []);

  const submitGuess = useCallback(
    async (heroId: string) => {
      if (!puzzle || status !== 'playing' || submitting) return;
      if (guesses.some((g) => g.id === heroId)) {
        setError('You already guessed that one.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const row = await getHeroById(heroId);
        if (!row) {
          setError('Could not load that hero.');
          return;
        }
        const clue = compareGuess(heroToGuessHero(row), puzzle.hero);
        const nextGuesses = [...guesses, clue];
        const won = clue.correct;
        const lost = !won && nextGuesses.length >= MAX_GUESSES;
        const nextStatus: SavedDay['status'] = won ? 'won' : lost ? 'lost' : 'playing';

        setGuesses(nextGuesses);
        setStatus(nextStatus);
        AsyncStorage.setItem(
          dayKey(puzzle.date),
          JSON.stringify({ guesses: nextGuesses, status: nextStatus } satisfies SavedDay),
        ).catch(() => {});

        if (won || lost) {
          setStreak((prev) => {
            const next = applyResult(prev, puzzle.date, won);
            AsyncStorage.setItem(STREAK_KEY, JSON.stringify(next)).catch(() => {});
            return next;
          });
        }
      } catch {
        setError('Something went wrong — try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [puzzle, status, submitting, guesses],
  );

  const finished = status === 'won' || status === 'lost';
  const answer = finished ? (puzzle?.hero ?? null) : null;

  const shareText = useMemo(() => {
    if (!puzzle || !finished) return '';
    return buildShareGrid({
      number: puzzle.number,
      guesses,
      solved: status === 'won',
      maxGuesses: MAX_GUESSES,
    });
  }, [puzzle, finished, guesses, status]);

  return {
    status,
    puzzleNumber: puzzle?.number ?? null,
    guesses,
    maxGuesses: MAX_GUESSES,
    remaining: MAX_GUESSES - guesses.length,
    streak,
    answer,
    submitting,
    error,
    shareText,
    submitGuess,
  };
}
