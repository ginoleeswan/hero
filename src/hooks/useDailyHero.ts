// Platform-neutral state for the daily "Guess the Hero" game (shared by the
// native + web screens). Loads the puzzle, restores saved progress + streak
// from local storage, and resolves each guess against today's answer — the
// portrait sharpens and a new clue is revealed on every miss. Win/lose + streak
// are tracked locally (Wordle-style), so it works logged in or not.
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyHero, type DailyPuzzle } from '../lib/db/dailyHero';
import { blurForGuess, buildClues, visibleClues, type Clue } from '../lib/game/reveal';
import { buildShareGrid } from '../lib/game/shareGrid';
import { applyResult, EMPTY_STREAK, type StreakState } from '../lib/game/streak';

export const MAX_GUESSES = 4;
export type GameStatus = 'loading' | 'error' | 'playing' | 'won' | 'lost';

export interface Guess {
  id: string;
  name: string;
  correct: boolean;
}

const dayKey = (date: string) => `dh_v3_${date}`;
const STREAK_KEY = 'dh_streak_v1';

interface SavedDay {
  guesses: Guess[];
  status: 'playing' | 'won' | 'lost';
}

export function useDailyHero() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [status, setStatus] = useState<GameStatus>('loading');
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
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
    (heroId: string, heroName: string) => {
      if (!puzzle || status !== 'playing') return;
      if (guesses.some((g) => g.id === heroId)) {
        setError('You already guessed that one.');
        return;
      }
      setError(null);

      const correct = heroId === puzzle.hero.id;
      const next = [...guesses, { id: heroId, name: heroName, correct }];
      const won = correct;
      const lost = !won && next.length >= MAX_GUESSES;
      const nextStatus: SavedDay['status'] = won ? 'won' : lost ? 'lost' : 'playing';

      setGuesses(next);
      setStatus(nextStatus);
      AsyncStorage.setItem(
        dayKey(puzzle.date),
        JSON.stringify({ guesses: next, status: nextStatus } satisfies SavedDay),
      ).catch(() => {});

      if (won || lost) {
        setStreak((prev) => {
          const updated = applyResult(prev, puzzle.date, won);
          AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }
    },
    [puzzle, status, guesses],
  );

  const finished = status === 'won' || status === 'lost';
  const answer = puzzle?.hero ?? null;

  const allClues = useMemo<Clue[]>(() => (puzzle ? buildClues(puzzle.hero) : []), [puzzle]);
  const clues = useMemo(
    () => visibleClues(allClues, guesses.length, finished),
    [allClues, guesses.length, finished],
  );
  const blur = blurForGuess(guesses.length, finished);

  const shareText = useMemo(() => {
    if (!puzzle || !finished) return '';
    return buildShareGrid({
      number: puzzle.number,
      attempts: guesses.length,
      solved: status === 'won',
      maxGuesses: MAX_GUESSES,
    });
  }, [puzzle, finished, guesses.length, status]);

  return {
    status,
    puzzleNumber: puzzle?.number ?? null,
    hero: answer, // always present once loaded — the portrait to reveal
    options: puzzle?.options ?? [],
    guesses,
    maxGuesses: MAX_GUESSES,
    remaining: MAX_GUESSES - guesses.length,
    blur,
    clues,
    streak,
    finished,
    answer: finished ? answer : null,
    error,
    shareText,
    submitGuess,
  };
}
