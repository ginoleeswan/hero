import { useQuery } from '@tanstack/react-query';
import { getTodaysMatchup, type TodaysMatchup } from '../lib/matchup';
import {
  getTopRivalries,
  getIconicHeroes,
  getMostFeared,
  type Rivalry,
  type Hero,
  type FearedVillain,
} from '../lib/db/heroes';
import { getTodaysTeamBattle, type TodaysTeamBattle } from '../lib/db/teams';

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

  return {
    matchup: matchupQ.data ?? null,
    rivalries: rivalriesQ.data ?? [],
    iconicPool: iconicQ.data ?? [],
    loading: matchupQ.isPending || rivalriesQ.isPending || iconicQ.isPending,
    teamBattle: teamBattleQ.data ?? null,
    mostFeared: mostFearedQ.data ?? [],
  };
}
