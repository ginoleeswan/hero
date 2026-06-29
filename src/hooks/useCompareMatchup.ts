import { useMemo } from 'react';
import { type VerdictInput } from '../lib/api';
import { useHeroStats, useVerdict } from '../lib/query/heroQueries';
import { compareStats, type CompareResult } from '../lib/compare';
import type { HeroStats } from '../types';

export interface CompareMatchup {
  statsA: HeroStats | null;
  statsB: HeroStats | null;
  /** compareStats output — null until both heroes load. */
  result: CompareResult | null;
  /** Overall matchup winner — null until both heroes load. */
  overallWinner: 'A' | 'B' | 'tie' | null;
  /** AI verdict text — null while generating. Cached per matchup via React Query. */
  verdict: string | null;
  error: string | null;
}

/**
 * Single source of truth for the compare screens (native + web). Loads both
 * heroes' stats, computes the comparison + overall winner, and fetches the
 * cached AI verdict. Both platform shells render the same data from here so
 * the screens cannot drift apart.
 */
export function useCompareMatchup(hero: string, opponent: string): CompareMatchup {
  // Each combatant's stats via React Query — keyed per hero, so they cache and
  // dedup across matchups (and revisiting a pair is instant).
  const a = useHeroStats(hero || undefined);
  const b = useHeroStats(opponent || undefined);
  const statsA = a.data ?? null;
  const statsB = b.data ?? null;
  const error =
    !hero || !opponent
      ? 'Invalid hero IDs.'
      : a.isError || b.isError
        ? 'Could not load hero data.'
        : null;

  // Verdict is cached per matchup (staleTime: Infinity), so the AI edge function
  // is invoked once — revisiting the same pair reuses the generated text.
  const verdictInput = useMemo<VerdictInput | null>(() => {
    if (!statsA || !statsB) return null;
    const r = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
    const toNums = (ps: HeroStats['powerstats']) =>
      Object.fromEntries(Object.entries(ps).map(([k, v]) => [k, parseInt(v, 10) || 0]));
    return {
      heroA: statsA.name,
      heroB: statsB.name,
      winsA: r.winsA,
      winsB: r.winsB,
      statsA: toNums(statsA.powerstats),
      statsB: toNums(statsB.powerstats),
    };
  }, [statsA, statsB]);

  const verdict = useVerdict(hero, opponent, verdictInput).data ?? null;

  const result =
    statsA && statsB
      ? compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats)
      : null;
  const overallWinner: 'A' | 'B' | 'tie' | null = result
    ? result.winsA > result.winsB
      ? 'A'
      : result.winsB > result.winsA
        ? 'B'
        : 'tie'
    : null;

  return { statsA, statsB, result, overallWinner, verdict, error };
}
