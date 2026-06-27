import { useEffect, useState } from 'react';
import { getTeamById, getTeamMembers, type TeamSummary } from '../lib/db/teams';
import type { RosterHero } from '../lib/teamBattle';

export interface TeamPage {
  team: TeamSummary | null;
  members: RosterHero[];
  loading: boolean;
  notFound: boolean;
}

// Platform-neutral data for the /team/[id] browse page: the team summary (header)
// + its full member roster (grid), fetched in parallel. Shared by the native and
// web views so they can't drift.
export function useTeamPage(id: string | undefined): TeamPage {
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [members, setMembers] = useState<RosterHero[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getTeamById(id), getTeamMembers(id, 300)])
      .then(([t, m]) => {
        if (cancelled) return;
        setTeam(t);
        setMembers(m);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { team, members, loading, notFound: !loading && team === null };
}
