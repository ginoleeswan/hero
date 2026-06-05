import { useEffect, useMemo, useState } from 'react';
import { getHeroById, heroRowToCharacterData } from '../lib/db/heroes';
import { fetchHeroStats, type VerdictInput } from '../lib/api';
import { useVerdict } from '../lib/query/heroQueries';
import { compareStats, type CompareResult } from '../lib/compare';
import type { HeroStats } from '../types';

async function loadHeroStats(id: string): Promise<HeroStats> {
  const row = await getHeroById(id);
  if (row?.enriched_at) return heroRowToCharacterData(row).stats;
  return fetchHeroStats(id);
}

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
  const [statsA, setStatsA] = useState<HeroStats | null>(null);
  const [statsB, setStatsB] = useState<HeroStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hero || !opponent) {
      setError('Invalid hero IDs.');
      return;
    }
    let cancelled = false;
    setError(null);
    setStatsA(null);
    setStatsB(null);
    Promise.all([loadHeroStats(hero), loadHeroStats(opponent)])
      .then(([a, b]) => {
        if (cancelled) return;
        setStatsA(a);
        setStatsB(b);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load hero data.');
      });
    return () => {
      cancelled = true;
    };
  }, [hero, opponent]);

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
