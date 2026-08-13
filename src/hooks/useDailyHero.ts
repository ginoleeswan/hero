// Platform-neutral state for the daily "Guess the Hero" game (shared by the
// native + web screens). Loads the puzzle, restores saved progress + streak
// from local storage, and resolves each guess against today's answer — the
// portrait sharpens and a new clue is revealed on every miss. Win/lose + streak
// are tracked locally (Wordle-style), so it works logged in or not.
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyHero, type DailyPuzzle } from '../lib/db/dailyHero';
import { getDailyDistribution, recordDailyResult } from '../lib/db/dailyStats';
import { recordDailyCompletion } from '../lib/db/dailies';
import { track } from '../lib/analytics';
import { blurForGuess, buildClues, visibleClues, type Clue } from '../lib/game/reveal';
import { buildDossier } from '../lib/game/dossier';
import { buildShareGrid } from '../lib/game/shareGrid';
import { applyResult, EMPTY_STREAK, type StreakState } from '../lib/game/streak';
import {
  beatPercent,
  EMPTY_STATS,
  recordStats,
  type DailyDistribution,
  type GameStats,
} from '../lib/game/stats';

export const MAX_GUESSES = 4;
export type GameStatus = 'loading' | 'error' | 'playing' | 'won' | 'lost';

export interface Guess {
  id: string;
  name: string;
  correct: boolean;
}

const dayKey = (date: string) => `dh_v3_${date}`;
const STREAK_KEY = 'dh_streak_v1';
const STATS_KEY = 'dh_stats_v1';
const recordedKey = (date: string) => `dh_rec_v1_${date}`;

interface SavedDay {
  guesses: Guess[];
  status: 'playing' | 'won' | 'lost';
}

export function useDailyHero() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [status, setStatus] = useState<GameStatus>('loading');
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [distribution, setDistribution] = useState<DailyDistribution | null>(null);
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
      const [savedRaw, streakRaw, statsRaw] = await Promise.all([
        AsyncStorage.getItem(dayKey(p.date)).catch(() => null),
        AsyncStorage.getItem(STREAK_KEY).catch(() => null),
        AsyncStorage.getItem(STATS_KEY).catch(() => null),
      ]);
      if (!active) return;
      if (streakRaw) {
        try {
          setStreak(JSON.parse(streakRaw) as StreakState);
        } catch {
          /* ignore corrupt streak */
        }
      }
      if (statsRaw) {
        try {
          setStats(JSON.parse(statsRaw) as GameStats);
        } catch {
          /* ignore corrupt stats */
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

      track('daily_guess', { attempt: next.length, correct: correct });
      if (won || lost) {
        setStreak((prev) => {
          const updated = applyResult(prev, puzzle.date, won);
          AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated)).catch(() => {});
          // Fired here rather than in an effect on `status`, so the streak
          // reported is the one this result produced — an effect would race the
          // state update and log the PREVIOUS streak on every finish.
          track('daily_finished', { won, attempts: next.length, streak: updated.current });
          return updated;
        });
        setStats((prev) => {
          const updated = recordStats(prev, puzzle.date, won, next.length, MAX_GUESSES);
          AsyncStorage.setItem(STATS_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        // Signed-in daily-streak calendar (playing counts, win or lose).
        // Fire-and-forget; no-ops when logged out.
        void recordDailyCompletion('puzzle');
      }
    },
    [puzzle, status, guesses],
  );

  const finished = status === 'won' || status === 'lost';
  const answer = puzzle?.hero ?? null;

  // Once finished, record this result to the global pool (once per day) and pull
  // back the day's distribution so we can show where the player landed.
  useEffect(() => {
    if (!finished || !puzzle) return;
    let active = true;
    (async () => {
      const key = recordedKey(puzzle.date);
      const already = await AsyncStorage.getItem(key).catch(() => null);
      if (!already) {
        await recordDailyResult(puzzle.date, status === 'won', guesses.length).catch(() => {});
        AsyncStorage.setItem(key, '1').catch(() => {});
      }
      const d = await getDailyDistribution(puzzle.date);
      if (active) setDistribution(d);
    })();
    return () => {
      active = false;
    };
    // Runs when the game finishes (or a finished day is restored on mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, puzzle?.date]);

  const allClues = useMemo<Clue[]>(() => (puzzle ? buildClues(puzzle.hero) : []), [puzzle]);
  const clues = useMemo(
    () => visibleClues(allClues, guesses.length, finished),
    [allClues, guesses.length, finished],
  );
  const blur = blurForGuess(guesses.length, finished);
  const dossier = useMemo(
    () => (puzzle ? buildDossier(puzzle.hero, finished) : null),
    [puzzle, finished],
  );
  const percentile = finished ? beatPercent(distribution, status === 'won', guesses.length) : null;

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
    dossier,
    streak,
    stats,
    distribution,
    percentile,
    finished,
    answer: finished ? answer : null,
    error,
    shareText,
    submitGuess,
  };
}
