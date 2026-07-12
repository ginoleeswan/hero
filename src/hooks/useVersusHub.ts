import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodaysMatchup, type TodaysMatchup } from '../lib/matchup';
import {
  getTopRivalries,
  getIconicHeroes,
  getMostFeared,
  getHeroesByIds,
  type Rivalry,
  type Hero,
  type FearedVillain,
} from '../lib/db/heroes';
import { getTodaysTeamBattle, type TodaysTeamBattle } from '../lib/db/teams';
import { getDailyDebate, getYesterdayResult, todayIso } from '../lib/db/dailyDebate';
import { getTakes } from '../lib/db/takes';
import { matchupVoteKey } from '../lib/home/matchupVote';
import { queryKeys, exploreKeys } from '../lib/query/keys';

export interface YesterdayDebateStrip {
  heroAId: string;
  heroBId: string;
  heroAName: string;
  heroBName: string;
  finalVotesA: number;
  finalVotesB: number;
  topTake: { body: string; displayName: string | null } | null;
  /** The viewer's own pick for yesterday's pair, read from the same local
   *  storage the vote card writes to — null if they never voted (or it can't
   *  be determined, e.g. on a fresh device). */
  yourPick: 'a' | 'b' | null;
}

/**
 * Backing data for the Versus hub: today's featured battle, the curated
 * rivalries rail, a "Public Enemies" villains leaderboard, and an iconic-hero
 * pool for "Surprise me". Each query caches independently; a failure degrades to
 * a hidden section, never a broken hub.
 */
export function useVersusHub() {
  const matchupQ = useQuery<TodaysMatchup | null>({
    queryKey: ['versus', 'todaysMatchup'],
    queryFn: getTodaysMatchup,
    staleTime: 1000 * 60 * 60, // an hour — the pair is stable for the day
  });
  const matchup = matchupQ.data ?? null;

  // The server-curated hook line for today's pair. getTodaysMatchup already
  // resolved the pair itself (via getTodaysMatchupFromPool); this is a thin
  // extra read (primary-keyed) surfacing the editorial hook text alongside it.
  const debateHookQ = useQuery<string | null>({
    queryKey: ['versus', 'todaysDebateHook'],
    queryFn: async () => (await getDailyDebate(todayIso()))?.hookText ?? null,
    staleTime: 1000 * 60 * 60,
  });

  // Takes count for the "N takes — join the debate" link. Shares the compare
  // page's cache key (queryKeys.takes) so navigating there is instant.
  const takesQ = useQuery({
    queryKey: matchup
      ? queryKeys.takes(matchup.heroA.id, matchup.heroB.id)
      : (['heroes', 'takes', 'none'] as const),
    queryFn: () => getTakes(matchup!.heroA.id, matchup!.heroB.id),
    enabled: !!matchup,
    staleTime: 1000 * 60 * 5,
  });

  const yesterdayResultQ = useQuery({
    queryKey: exploreKeys.debateYesterday,
    queryFn: getYesterdayResult,
    staleTime: 1000 * 60 * 60,
  });
  const yesterdayResult = yesterdayResultQ.data ?? null;

  // Hero names aren't in the yesterday-result row — resolve them by id
  // (cheap: at most two rows, cached alongside the result).
  const yesterdayHeroesQ = useQuery({
    queryKey: yesterdayResult
      ? ['versus', 'yesterdayHeroes', yesterdayResult.heroAId, yesterdayResult.heroBId]
      : (['versus', 'yesterdayHeroes', 'none'] as const),
    queryFn: () => getHeroesByIds([yesterdayResult!.heroAId, yesterdayResult!.heroBId]),
    enabled: !!yesterdayResult,
    staleTime: 1000 * 60 * 60,
  });

  // The viewer's own pick for yesterday's pair, mirrored locally by
  // useMatchupVote at matchupVoteKey(a, b, <that day's local date>).
  const [yourPick, setYourPick] = useState<'a' | 'b' | null>(null);
  useEffect(() => {
    if (!yesterdayResult) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYourPick(null);
      return;
    }
    let active = true;
    const localYesterday = new Date();
    localYesterday.setDate(localYesterday.getDate() - 1);
    const key = matchupVoteKey(yesterdayResult.heroAId, yesterdayResult.heroBId, localYesterday);
    AsyncStorage.getItem(key)
      .then((v) => {
        if (active && (v === 'a' || v === 'b')) setYourPick(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [yesterdayResult]);

  const rivalriesQ = useQuery<Rivalry[]>({
    queryKey: ['versus', 'topRivalries', 12],
    queryFn: () => getTopRivalries(12),
    staleTime: 1000 * 60 * 30,
  });

  const iconicQ = useQuery<Hero[]>({
    queryKey: ['versus', 'iconicPool', 24],
    queryFn: () => getIconicHeroes(24),
    staleTime: 1000 * 60 * 30,
  });

  const teamBattleQ = useQuery<TodaysTeamBattle | null>({
    queryKey: ['versus', 'todaysTeamBattle'],
    queryFn: getTodaysTeamBattle,
    staleTime: 1000 * 60 * 60,
  });

  const mostFearedQ = useQuery<FearedVillain[]>({
    queryKey: ['versus', 'mostFeared', 12],
    queryFn: () => getMostFeared(12),
    staleTime: 1000 * 60 * 30,
  });

  const yesterdayHeroes = yesterdayHeroesQ.data ?? [];
  const yesterday: YesterdayDebateStrip | null =
    yesterdayResult && yesterdayHeroes.length === 2
      ? {
          heroAId: yesterdayResult.heroAId,
          heroBId: yesterdayResult.heroBId,
          heroAName:
            yesterdayHeroes.find((h) => h.id === yesterdayResult.heroAId)?.name ?? 'Hero A',
          heroBName:
            yesterdayHeroes.find((h) => h.id === yesterdayResult.heroBId)?.name ?? 'Hero B',
          finalVotesA: yesterdayResult.finalVotesA,
          finalVotesB: yesterdayResult.finalVotesB,
          topTake: yesterdayResult.topTake,
          yourPick,
        }
      : null;

  return {
    matchup,
    hookText: debateHookQ.data ?? null,
    takesCount: takesQ.data?.length ?? 0,
    yesterday,
    rivalries: rivalriesQ.data ?? [],
    iconicPool: iconicQ.data ?? [],
    loading: matchupQ.isPending || rivalriesQ.isPending || iconicQ.isPending,
    teamBattle: teamBattleQ.data ?? null,
    mostFeared: mostFearedQ.data ?? [],
  };
}
