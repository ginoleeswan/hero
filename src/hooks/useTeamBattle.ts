import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTodaysTeamBattle, getTeamRoster, getTeamSynergy,
  getTeamBattleTally, castTeamBattleVote, getFeaturedTeams,
  type FeaturedTeam, type TeamTally,
} from '../lib/db/teams';
import { getCachedTeamVerdict } from '../lib/db/teamVerdicts';
import { generateTeamVerdict } from '../lib/api';
import { resolveTeamBattle, type TeamSide, type TeamBattleResult } from '../lib/teamBattle';

export interface UseTeamBattle {
  loading: boolean;
  sideA: TeamSide | null; sideB: TeamSide | null;
  result: TeamBattleResult | null;
  tally: TeamTally | null;
  vote: (teamId: string) => Promise<void>;
}

async function buildSide(team: FeaturedTeam): Promise<TeamSide> {
  const roster = await getTeamRoster(team.id, 5);
  const synergy = await getTeamSynergy(roster.map((h) => h.id));
  return { team: { id: team.id, name: team.name, publisher: team.publisher, logo_url: team.logo_url }, roster, synergy };
}

// "avengers-vs-justice-league" → ["avengers","justice-league"]
function parseBattleId(id: string): [string, string] | null {
  const i = id.indexOf('-vs-');
  if (i < 0) return null;
  return [id.slice(0, i), id.slice(i + 4)];
}

export function useTeamBattle(battleId?: string): UseTeamBattle {
  const qc = useQueryClient();

  const battleQ = useQuery({
    queryKey: ['teamBattle', battleId ?? 'today'],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      let aId: string, bId: string, aName: string, bName: string;
      if (battleId && parseBattleId(battleId)) {
        const teams = await getFeaturedTeams();
        const [pa, pb] = parseBattleId(battleId)!;
        const ta = teams.find((t) => t.id === pa);
        const tb = teams.find((t) => t.id === pb);
        if (!ta || !tb) return null;
        const [sa, sb] = [await buildSide(ta), await buildSide(tb)];
        const result = resolveTeamBattle(sa, sb);
        return { sideA: sa, sideB: sb, result, aId: ta.id, bId: tb.id, aName: ta.name, bName: tb.name };
      }
      const today = await getTodaysTeamBattle();
      if (!today) return null;
      const [sa, sb] = [await buildSide(today.teamA), await buildSide(today.teamB)];
      const result = resolveTeamBattle(sa, sb);
      return { sideA: sa, sideB: sb, result, aId: today.teamA.id, bId: today.teamB.id,
               aName: today.teamA.name, bName: today.teamB.name };
    },
  });

  const b = battleQ.data ?? null;

  // Verdict: cache first, generate on miss. Overrides the deterministic line.
  const verdictQ = useQuery({
    queryKey: ['teamVerdict', b?.aId, b?.bId],
    enabled: !!b,
    staleTime: Infinity,
    queryFn: async () => {
      if (!b) return null;
      const cached = await getCachedTeamVerdict(b.aId, b.bId);
      if (cached) return cached;
      return generateTeamVerdict({
        teamAId: b.aId, teamBId: b.bId, teamA: b.aName, teamB: b.bName,
        splitA: b.result.splitA, splitB: b.result.splitB,
      });
    },
  });

  const tallyQ = useQuery({
    queryKey: ['teamTally', b?.aId, b?.bId],
    enabled: !!b,
    queryFn: () => (b ? getTeamBattleTally(b.aId, b.bId) : Promise.resolve(null)),
  });

  const vote = useCallback(
    async (teamId: string) => {
      if (!b) return;
      const fresh = await castTeamBattleVote(b.aId, b.bId, teamId);
      if (fresh) qc.setQueryData(['teamTally', b.aId, b.bId], fresh);
    },
    [b, qc],
  );

  const result = b
    ? { ...b.result, verdict: verdictQ.data ?? b.result.verdict }
    : null;

  return {
    loading: battleQ.isPending,
    sideA: b?.sideA ?? null,
    sideB: b?.sideB ?? null,
    result,
    tally: tallyQ.data ?? null,
    vote,
  };
}
