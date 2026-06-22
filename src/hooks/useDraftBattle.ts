import { useQuery } from '@tanstack/react-query';
import { getDraftRoster, getTeamSynergy } from '../lib/db/teams';
import { resolveTeamBattle, type TeamSide, type TeamBattleResult, type RosterHero } from '../lib/teamBattle';

export interface UseDraftBattle {
  loading: boolean;
  sideA: TeamSide | null;
  sideB: TeamSide | null;
  result: TeamBattleResult | null;
}

async function buildDraftSide(ids: string[], id: 'draft-a' | 'draft-b'): Promise<TeamSide | null> {
  const roster: RosterHero[] = await getDraftRoster(ids);
  if (roster.length === 0) return null;
  const synergy = await getTeamSynergy(roster.map((h) => h.id));
  const captain = roster[0];
  return {
    team: { id, name: captain?.name ?? 'Team', publisher: null, logo_url: null },
    roster,
    synergy,
  };
}

/** Resolve a drafted matchup (arbitrary hero ids per side) into two TeamSides and
 *  the engine verdict. Cached by the id lists so a reload re-resolves cleanly. */
export function useDraftBattle(aIds: string[], bIds: string[]): UseDraftBattle {
  const key = `${aIds.join(',')}|${bIds.join(',')}`;
  const q = useQuery({
    queryKey: ['draftBattle', key],
    staleTime: 1000 * 60 * 30,
    enabled: aIds.length > 0 && bIds.length > 0,
    queryFn: async () => {
      const [sideA, sideB] = await Promise.all([buildDraftSide(aIds, 'draft-a'), buildDraftSide(bIds, 'draft-b')]);
      if (!sideA || !sideB) return null;
      return { sideA, sideB, result: resolveTeamBattle(sideA, sideB) };
    },
  });

  const d = q.data ?? null;
  return {
    loading: q.isPending,
    sideA: d?.sideA ?? null,
    sideB: d?.sideB ?? null,
    result: d?.result ?? null,
  };
}
