import { useQuery } from '@tanstack/react-query';
import { getFeaturedTeams, type FeaturedTeam } from '../lib/db/teams';

/** Featured teams that back the builder's iconic-team presets. Degrades to []
 *  (getFeaturedTeams already swallows errors). */
export function usePresetTeams(): { teams: FeaturedTeam[]; loading: boolean } {
  const q = useQuery({
    queryKey: ['presetTeams'],
    staleTime: 1000 * 60 * 30,
    queryFn: getFeaturedTeams,
  });
  return { teams: q.data ?? [], loading: q.isPending };
}
